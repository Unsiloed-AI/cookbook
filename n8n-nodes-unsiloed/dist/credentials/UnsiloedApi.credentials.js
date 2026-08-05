"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UnsiloedApi = void 0;
class UnsiloedApi {
    constructor() {
        this.name = 'unsiloedApi';
        this.displayName = 'Unsiloed API';
        this.documentationUrl = 'https://docs.unsiloed.ai';
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
        // Sends the api-key header on generic HTTP calls. The "Test" button is wired up
        // separately, by the node's `unsiloedApiTest` method (see Unsiloed.node.ts) —
        // Unsiloed has no endpoint that returns 2xx for an authenticated GET, which is
        // what a declarative `test` block would need.
        this.authenticate = {
            type: 'generic',
            properties: {
                headers: {
                    'api-key': '={{$credentials.apiKey}}',
                },
            },
        };
    }
}
exports.UnsiloedApi = UnsiloedApi;
