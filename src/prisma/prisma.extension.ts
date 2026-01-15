import { Prisma } from '@prisma/client';

export const paginationExtension = Prisma.defineExtension({
  name: 'pagination',
  model: {
    $allModels: {
      async paginate<T, A>(
        this: T,
        args: Prisma.Exact<A, Prisma.Args<T, 'findMany'>> & {
          page?: number;
          limit?: number;
        },
      ) {
        const { page = 1, limit = 10, ...restArgs } = args as any;
        const skip = (page - 1) * limit;

        const context = Prisma.getExtensionContext(this);

        const [total, data] = await Promise.all([
          (context as any).count({ where: restArgs.where }),
          (context as any).findMany({
            ...restArgs,
            skip,
            take: limit,
          }),
        ]);

        const last_page = Math.ceil(total / limit);

        return {
          data,
          meta: {
            total,
            page,
            last_page,
            limit,
            has_next_page: page < last_page,
            has_prev_page: page > 1,
          },
        };
      },
    },
  },
});
