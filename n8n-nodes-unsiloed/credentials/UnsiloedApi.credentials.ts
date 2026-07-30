import {
	IAuthenticateGeneric,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class UnsiloedApi implements ICredentialType {
	name = 'unsiloedApi';

	displayName = 'Unsiloed API';

	documentationUrl = 'https://docs.unsiloed.ai';

	properties: INodeProperties[] = [
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

	// Sends the api-key header on n8n's built-in "Test" and on generic HTTP calls.
	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				'api-key': '={{$credentials.apiKey}}',
			},
		},
	};
}
