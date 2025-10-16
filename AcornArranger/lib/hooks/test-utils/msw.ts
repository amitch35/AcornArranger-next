import { setupServer } from "msw/node";
import { http, HttpResponse, delay } from "msw";

export const server = setupServer();

export const handlers = {
  successList: (path: string, data: unknown, total = 1) =>
    http.get(path, async () => {
      return HttpResponse.json({ data, total }, { status: 200 });
    }),
  successListWithQuery: (path: string, resolver: (req: Request) => { data: unknown; total: number }) =>
    http.get(path, async ({ request }) => {
      const { data, total } = resolver(request);
      return HttpResponse.json({ data, total }, { status: 200 });
    }),
  delayed: (path: string, ms = 200) =>
    http.get(path, async () => {
      await delay(ms);
      return HttpResponse.json({ data: [], total: 0 }, { status: 200 });
    }),
  error: (path: string, status = 500) =>
    http.get(path, async () => new HttpResponse("fail", { status })),
};


