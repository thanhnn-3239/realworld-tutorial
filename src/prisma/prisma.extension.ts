import { Prisma } from '../generated/prisma/client';

export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 10;

export interface PaginationMeta {
  total: number;
  page: number;
  last_page: number;
  limit: number;
  has_next_page: boolean;
  has_prev_page: boolean;
}

export interface Paginated<T> {
  data: T;
  meta: PaginationMeta;
}

export interface PaginateArgs {
  page?: number;
  limit?: number;
}

export function paginationSkip(page: number, limit: number): number {
  return (page - 1) * limit;
}

export function buildPaginationMeta(
  total: number,
  page: number,
  limit: number,
): PaginationMeta {
  const last_page = Math.ceil(total / limit);

  return {
    total,
    page,
    last_page,
    limit,
    has_next_page: page < last_page,
    has_prev_page: page > 1,
  };
}

export const paginationExtension = Prisma.defineExtension({
  name: 'pagination',
  model: {
    $allModels: {
      async paginate<T, A extends Prisma.Args<T, 'findMany'>>(
        this: T,
        args: A & PaginateArgs,
      ): Promise<Paginated<Prisma.Result<T, A, 'findMany'>>> {
        const {
          page = DEFAULT_PAGE,
          limit = DEFAULT_LIMIT,
          ...findManyArgs
        } = args as PaginateArgs & { where?: unknown };

        const model = Prisma.getExtensionContext(this) as unknown as {
          count(args: { where?: unknown }): Promise<number>;
          findMany(args: unknown): Promise<Prisma.Result<T, A, 'findMany'>>;
        };

        const [total, data] = await Promise.all([
          model.count({ where: findManyArgs.where }),
          model.findMany({
            ...findManyArgs,
            skip: paginationSkip(page, limit),
            take: limit,
          }),
        ]);

        return { data, meta: buildPaginationMeta(total, page, limit) };
      },
    },
  },
});
