import {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	Icon,
	INodeProperties,
} from 'n8n-workflow';

export class UnsiloedApi implements ICredentialType {
	name = 'unsiloedApi';

	displayName = 'Unsiloed API';

	documentationUrl = 'https://docs.unsiloed.ai';

	// One file for both themes; the mark carries its own coloured plate.
	icon: Icon = 'file:../nodes/Unsiloed/unsiloed.svg';

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

	authenticate: IAuthenticateGeneric = {
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
	test: ICredentialTestRequest = {
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
