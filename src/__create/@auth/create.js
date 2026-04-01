import { getToken } from '@auth/core/jwt';
import { getContext } from 'hono/context-storage';
import { isSecureAuthRequest } from '@/utils/auth-url';

export default function CreateAuth() {
	const auth = async () => {
		const c = getContext();
		const token = await getToken({
			req: c.req.raw,
			secret: process.env.AUTH_SECRET ?? (process.env.NODE_ENV !== 'production' ? 'dev-auth-secret' : undefined),
			secureCookie: isSecureAuthRequest(c.req.raw),
		});
		if (token) {
			return {
				user: {
					id: token.sub,
					email: token.email,
					name: token.name,
					image: token.picture,
				},
				expires: token.exp.toString(),
			};
		}
	};
	return {
		auth,
	};
}
