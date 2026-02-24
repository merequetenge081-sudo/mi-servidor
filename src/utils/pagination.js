export function parseLimit(rawValue, options = {}) {
  const defaultLimit = options.defaultLimit ?? 20;
  const maxLimit = options.maxLimit ?? 100;

  const parsed = parseInt(rawValue, 10);
  const limit = Number.isFinite(parsed) && parsed > 0 ? parsed : defaultLimit;

  return Math.min(limit, maxLimit);
}

export function parsePagination(query, options = {}) {
  const defaultPage = options.defaultPage ?? 1;
  const defaultLimit = options.defaultLimit ?? 20;
  const maxLimit = options.maxLimit ?? 100;

  const rawPage = query?.page ?? query?.pageNumber;
  const rawLimit = query?.limit ?? query?.pageSize ?? query?.perPage ?? query?.per_page;

  const parsedPage = parseInt(rawPage, 10);
  const parsedLimit = parseLimit(rawLimit, { defaultLimit, maxLimit });

  const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : defaultPage;
  const limit = parsedLimit;
  const skip = (page - 1) * limit;

  return { page, limit, skip };
}
