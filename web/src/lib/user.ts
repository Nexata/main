import { withAuthRetry, apiClient } from "@/api";

export async function getMe() {
  return await withAuthRetry((headers) =>
    apiClient.api.user.me.get({
        $headers: headers,
    })
  );
}
export type Me = Awaited<ReturnType<typeof getMe>>;

export async function updateMe(data: {
    displayName?: string;
    pfp?: File;
}): Promise<NonNullable<Me>> {
    await withAuthRetry((headers) => {
        return apiClient.api.user.me.patch({
        $headers: headers,
        displayName: data.displayName,
        pfp: data.pfp,
        });
    });

    const me = await getMe();
    if (!me) throw new Error("User not found after update");

    return me;
}

export async function getUsers() {
  return await withAuthRetry((headers) =>
    apiClient.api.user.get({
      $headers: headers,
    })
  );
}

export type Users = Awaited<ReturnType<typeof getUsers>>;