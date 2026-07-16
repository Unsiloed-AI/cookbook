"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Unsiloed = void 0;
const n8n_workflow_1 = require("n8n-workflow");
// Job states Unsiloed reports; we normalise across the /parse and /extract endpoints.
const DONE = ['completed', 'Succeeded', 'succeeded', 'review'];
const FAILED = ['failed', 'Failed', 'Cancelled', 'cancelled', 'error'];
class Unsiloed {
    constructor() {
        this.description = {
            displayName: 'Unsiloed',
            name: 'unsiloed',
            icon: 'file:unsiloed.png',
            group: ['transform'],
            version: 1,
            subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
            description: 'Parse and OCR documents into clean Markdown, or extract structured fields, with Unsiloed AI',
            defaults: {
                name: 'Unsiloed',
            },
            inputs: ['main'],
            outputs: ['main'],
            credentials: [
                {
                    name: 'unsiloedApi',
                    required: true,
                },
            ],
            properties: [
                {
                    displayName: 'Resource',
                    name: 'resource',
                    type: 'options',
                    noDataExpression: true,
                    options: [{ name: 'Document', value: 'document' }],
                    default: 'document',
                },
                {
                    displayName: 'Operation',
                    name: 'operation',
                    type: 'options',
                    noDataExpression: true,
                    displayOptions: { show: { resource: ['document'] } },
                    options: [
                        {
                            name: 'Parse',
                            value: 'parse',
                            action: 'Parse a document into clean Markdown',
                            description: 'OCR the document and return layout-aware Markdown (tables, headings, text)',
                        },
                        {
                            name: 'Extract',
                            value: 'extract',
                            action: 'Extract structured fields from a document',
                            description: 'Pull named fields into JSON using a schema you define',
                        },
                    ],
                    default: 'parse',
                },
                {
                    displayName: 'Input Binary Field',
                    name: 'binaryPropertyName',
                    type: 'string',
                    default: 'data',
                    required: true,
                    description: 'Name of the binary property that holds the document (PDF, scan or image)',
                },
                // ---- Parse options ----
                {
                    displayName: 'Force OCR',
                    name: 'forceOcr',
                    type: 'boolean',
                    default: true,
                    displayOptions: { show: { operation: ['parse'] } },
                    description: 'Whether to OCR the rendered pixels instead of trusting the PDF text layer. Leave on for scans, images, and PDFs with a broken or garbled text layer.',
                },
                {
                    displayName: 'Output',
                    name: 'output',
                    type: 'options',
                    default: 'markdown',
                    displayOptions: { show: { operation: ['parse'] } },
                    options: [
                        { name: 'Markdown', value: 'markdown', description: 'A single Markdown string in the "markdown" field' },
                        { name: 'Full JSON', value: 'json', description: 'The complete parse result (chunks, segments, metadata)' },
                    ],
                },
                // ---- Extract options ----
                {
                    displayName: 'Schema (JSON)',
                    name: 'schema',
                    type: 'json',
                    default: '{\n  "type": "object",\n  "properties": {\n    "invoice_number": { "type": "string" },\n    "total_due": { "type": "string" },\n    "issue_date": { "type": "string" }\n  }\n}',
                    displayOptions: { show: { operation: ['extract'] } },
                    description: 'JSON Schema describing the fields to extract',
                },
            ],
        };
    }
    async execute() {
        const items = this.getInputData();
        const returnData = [];
        const credentials = await this.getCredentials('unsiloedApi');
        const apiKey = credentials.apiKey;
        const baseUrl = (credentials.baseUrl || 'https://prod.visionapi.unsiloed.ai').replace(/\/+$/, '');
        const poll = async (path) => {
            for (let attempt = 0; attempt < 90; attempt++) {
                const job = (await this.helpers.request({
                    method: 'GET',
                    uri: `${baseUrl}${path}`,
                    headers: { 'api-key': apiKey },
                    json: true,
                }));
                const status = job.status;
                if (DONE.includes(status))
                    return job;
                if (FAILED.includes(status)) {
                    throw new n8n_workflow_1.NodeApiError(this.getNode(), job, {
                        message: `Unsiloed job ${status}`,
                        description: job.error || job.message || '',
                    });
                }
                await (0, n8n_workflow_1.sleep)(4000);
            }
            throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'Unsiloed job did not finish within the time limit');
        };
        for (let i = 0; i < items.length; i++) {
            try {
                const operation = this.getNodeParameter('operation', i);
                const binaryPropertyName = this.getNodeParameter('binaryPropertyName', i);
                const binaryData = this.helpers.assertBinaryData(i, binaryPropertyName);
                const buffer = await this.helpers.getBinaryDataBuffer(i, binaryPropertyName);
                const fileName = binaryData.fileName || 'document.pdf';
                const contentType = binaryData.mimeType || 'application/pdf';
                if (operation === 'parse') {
                    const forceOcr = this.getNodeParameter('forceOcr', i);
                    const output = this.getNodeParameter('output', i);
                    const formData = {
                        file: { value: buffer, options: { filename: fileName, contentType } },
                        layout_analysis: 'smart_layout_detection',
                        ocr_engine: 'UnsiloedBeta',
                        // Render logos/figures as plain markdown instead of a VLM "image description" essay.
                        segment_analysis: JSON.stringify({ Picture: { markdown: 'Auto' } }),
                    };
                    if (forceOcr)
                        formData.ocr_strategy = 'force_ocr';
                    const submit = (await this.helpers.request({
                        method: 'POST',
                        uri: `${baseUrl}/parse`,
                        headers: { 'api-key': apiKey },
                        formData,
                        json: true,
                    }));
                    const result = await poll(`/parse/${submit.job_id}`);
                    if (output === 'json') {
                        returnData.push({ json: result, pairedItem: { item: i } });
                    }
                    else {
                        const parts = [];
                        for (const chunk of result.chunks || []) {
                            for (const seg of chunk.segments || []) {
                                const text = seg.markdown || seg.content || '';
                                if (text)
                                    parts.push(text);
                            }
                        }
                        const markdown = parts.join('\n').trim();
                        returnData.push({
                            json: {
                                markdown,
                                page_count: result.page_count ?? null,
                                job_id: submit.job_id ?? null,
                            },
                            pairedItem: { item: i },
                        });
                    }
                }
                else {
                    // operation === 'extract'
                    const schemaRaw = this.getNodeParameter('schema', i);
                    const schema = typeof schemaRaw === 'string' ? schemaRaw : JSON.stringify(schemaRaw);
                    const submit = (await this.helpers.request({
                        method: 'POST',
                        uri: `${baseUrl}/v2/extract`,
                        headers: { 'api-key': apiKey },
                        formData: {
                            pdf_file: { value: buffer, options: { filename: fileName, contentType } },
                            schema_data: schema,
                            model: 'gamma',
                            // Run the grounding pass so every field returns real confidence scores
                            // plus a citation (page + bounding box).
                            enable_citations: 'true',
                        },
                        json: true,
                    }));
                    const job = await poll(`/extract/${submit.job_id}`);
                    const result = job.result ?? job;
                    returnData.push({ json: result, pairedItem: { item: i } });
                }
            }
            catch (error) {
                if (this.continueOnFail()) {
                    returnData.push({ json: { error: error.message }, pairedItem: { item: i } });
                    continue;
                }
                throw error;
            }
        }
        return [returnData];
    }
}
exports.Unsiloed = Unsiloed;
