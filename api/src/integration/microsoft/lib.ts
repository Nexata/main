import { Client } from '@microsoft/microsoft-graph-client';

export namespace Microsoft {
	export type GraphClient = Client;

	export const fromTokens = (accessToken: string, _refreshToken: string) =>
		Client.init({ authProvider: (done) => done(null, accessToken) });
}
