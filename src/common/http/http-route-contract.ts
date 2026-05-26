import type { OpenAPIObject } from '@nestjs/swagger';

const HTTP_METHODS = [
  'get',
  'post',
  'put',
  'patch',
  'delete',
  'options',
  'head',
] as const;

type RegisteredRoute = {
  pattern: RegExp;
  allowedMethods: string[];
};

type SupplementalRoute = {
  path: string;
  methods: string[];
};

export class HttpRouteContract {
  private readonly registeredRoutes: RegisteredRoute[];

  constructor(
    swaggerDocument: OpenAPIObject,
    supplementalRoutes: SupplementalRoute[] = [],
  ) {
    this.registeredRoutes = [
      ...Object.entries(swaggerDocument.paths).map(([path, definition]) => ({
        pattern: this.compilePath(path),
        allowedMethods: this.resolveMethods(definition),
      })),
      ...supplementalRoutes.map((route) => ({
        pattern: this.compilePath(route.path),
        allowedMethods: route.methods.map((method) => method.toUpperCase()),
      })),
    ];
  }

  allowedMethodsForPath(path: string): string[] | null {
    const route = this.registeredRoutes.find((registeredRoute) =>
      registeredRoute.pattern.test(path),
    );

    return route?.allowedMethods ?? null;
  }

  isUnsupportedMethod(path: string, method: string): string[] | null {
    const allowedMethods = this.allowedMethodsForPath(path);

    if (!allowedMethods) {
      return null;
    }

    const normalizedMethod = method.toUpperCase();

    if (allowedMethods.includes(normalizedMethod)) {
      return null;
    }

    return allowedMethods;
  }

  private resolveMethods(
    definition: OpenAPIObject['paths'][string] | undefined,
  ): string[] {
    if (!definition) {
      return [];
    }

    const methods = HTTP_METHODS.filter(
      (method) => definition[method] !== undefined,
    ).map((method) => method.toUpperCase());

    if (methods.includes('GET') && !methods.includes('HEAD')) {
      methods.push('HEAD');
    }

    return methods;
  }

  private compilePath(path: string): RegExp {
    const segments = path.split('/').map((segment) => {
      if (segment.startsWith('{') && segment.endsWith('}')) {
        return '[^/]+';
      }

      return segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    });

    return new RegExp(`^${segments.join('/')}/?$`);
  }
}
