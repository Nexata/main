import { dropboxFilesSearchTool } from '@api/chat/tools/dropbox';
import { NexataListCredentialsTool } from '@api/chat/tools/nexata';
import { OauthScope } from '@api/schema';
import type { JwtPayload } from '@api/utils/auth';
import { getCredentialsForUser } from '@api/utils/credential';
import type { ToolSet } from 'ai';

export const getTools = async (
	activeUser: JwtPayload,
	_threadId: string | null = null,
) => {
	const credentials = await getCredentialsForUser(activeUser, 'usage');

	let tools: ToolSet = {
		NexataListCredentials: NexataListCredentialsTool(activeUser),
	};

	const dropboxCredentials = credentials.filter((c) =>
		c.scopes.includes(OauthScope.DROPBOX),
	);

	if (dropboxCredentials.length)
		tools = {
			...tools,
			dropboxFilesSearch: dropboxFilesSearchTool(dropboxCredentials),
		};

	return tools;
};
