import { OauthScope } from '@api/schema';
import { dropboxFilesSearchTool } from '@api/tools/dropbox';
import { NexataListCredentialsTool } from '@api/tools/nexata';
import type { JwtPayload } from '@api/utils/auth';
import { getCredentialsForUser } from '@api/utils/credential';
import type { ToolSet } from 'ai';

export const getTools = async (
	activeUser: JwtPayload,
	_threadId: string | null = null,
) => {
	const credentials = await getCredentialsForUser(activeUser, 'usage');

	let tools: ToolSet = {
		NexataListCredentials: NexataListCredentialsTool(credentials),
	};

	const dropboxCredentials = credentials.filter((c) =>
		c.scope.includes(OauthScope.DROPBOX),
	);

	if (dropboxCredentials.length)
		tools = {
			...tools,
			dropboxFilesSearch: dropboxFilesSearchTool(dropboxCredentials),
		};

	return tools;
};
