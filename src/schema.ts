import { z } from 'zod';
export const Post = z.object({
  id: z.string().min(1),
  status: z.literal('approved'),
  title: z.string().startsWith('[요가 수련일지]'),
  practiceDate: z.iso.date(),
  practiceType: z.string().min(1),
  storeUrl: z.url(),
  content: z.string().min(1),
});
