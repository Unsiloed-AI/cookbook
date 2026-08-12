"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UnsiloedApi = void 0;
class UnsiloedApi {
    constructor() {
        this.name = 'unsiloedApi';
        this.displayName = 'Unsiloed API';
        this.documentationUrl = 'https://docs.unsiloed.ai';
        // One file for both themes; the mark carries its own coloured plate.
        this.icon = 'file:../nodes/Unsiloed/unsiloed.svg';
        this.properties = [
            {
                displayName: 'API Key',
                name: 'apiKey',
                type: 'string',
                typeOptions: { password: true },
                default: '',
                required: true,
                description: 'Your Unsiloed API key (sent as the api-key header)',
            },
            {
                displayName: 'Base URL',
                name: 'baseUrl',
                type: 'string',
                default: 'https://prod.visionapi.unsiloed.ai',
                description: 'Unsiloed API base URL. Change only for a private / self-hosted deployment.',
            },
        ];
        this.authenticate = {
            type: 'generic',
            properties: {
                headers: {
                    'api-key': '={{$credentials.apiKey}}',
                },
            },
        };
        // Backs the "Test" button. Unsiloed has no endpoint that returns 2xx for an
        // authenticated read, so this POSTs to /parse with no file and reads which
        // rejection comes back: a working key gets 400 "Content type error", a bad one
        // gets 401 with error.code "auth_failed". ignoreHttpStatusErrors keeps the 400
        // from being reported as a failure, and the rule below turns the 401 into one.
        this.test = {
            request: {
                method: 'POST',
                baseURL: '={{$credentials.baseUrl}}',
                url: '/parse',
                ignoreHttpStatusErrors: true,
            },
            rules: [
                {
                    type: 'responseSuccessBody',
                    properties: {
                        key: 'error.code',
                        value: 'auth_failed',
                        message: 'Unsiloed rejected this API key.',
                    },
                },
            ],
        };
    }
}
exports.UnsiloedApi = UnsiloedApi;
