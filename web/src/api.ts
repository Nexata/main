import type { App } from "@api";
import { edenTreaty } from "@elysiajs/eden";
import { getAccessToken } from "@/lib/auth";

// export const { api } = edenTreaty<App>("http://localhost:3000", {
//   headers: () => {
//     const token = getAccessToken();
//     return token ? { authorization: `Bearer ${token}` } : {};
//   },
// });
