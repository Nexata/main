import { mpRouter } from '@api/payment/mp';
import Elysia from 'elysia';

export const paymentRouter = new Elysia({ prefix: '/payment' }).use(mpRouter);
