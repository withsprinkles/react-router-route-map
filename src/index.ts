import type { RouteConfigEntry } from "@react-router/dev/routes";
import { index as rrIndex, layout as rrLayout, route as rrRoute } from "@react-router/dev/routes";
import { RoutePattern, type RoutePatternOptions } from "@remix-run/route-pattern";

export const RouteConfig = Symbol.for("RouteConfig");

// MARK: Types

export interface RouteMap {
    [key: string]: Route<any> | RouteMap;
}

type ParamValue = string | number | bigint | boolean;

// Split search string by & to get individual param names
type SplitSearch<S extends string> = S extends `${infer First}&${infer Rest}`
    ? First | SplitSearch<Rest>
    : S extends ""
      ? never
      : S;

// Extract search param names from pattern (after the ?)
type SearchParamNames<Pattern extends string> = Pattern extends `${string}?${infer Search}`
    ? SplitSearch<Search>
    : never;

// Strict search params object - only allows keys that are in the pattern
type StrictSearchParams<Pattern extends string> = [SearchParamNames<Pattern>] extends [never]
    ? never // No search params in pattern, so none allowed
    : { [key in SearchParamNames<Pattern>]?: ParamValue };

// Extract path parameter names from pattern
type ExtractPathParams<T extends string> = T extends `${string}:${infer Param}/${infer Rest}`
    ? Param | ExtractPathParams<Rest>
    : T extends `${string}:${infer Param}?${string}`
      ? Param
      : T extends `${string}:${infer Param}`
        ? Param
        : never;

// Get required params (those in the path before ?)
type RequiredParams<T extends string> = ExtractPathParams<T extends `${infer P}?${string}` ? P : T>;

// Input any ParamValue for path params type
type StrictPathParams<T extends string> = [RequiredParams<T>] extends [never]
    ? {}
    : { [key in RequiredParams<T>]: ParamValue };

// Custom href args with strict search param validation
type StrictHrefBuilderArgs<T extends string> = [SearchParamNames<T>] extends [never]
    ? // No search params in pattern
      [RequiredParams<T>] extends [never]
        ? // No path params either - allow no args or null
          [] | [null | undefined]
        : // Has path params but no search params
          [StrictPathParams<T>]
    : // Has search params
      [RequiredParams<T>] extends [never]
      ? // No required path params, but has search params - allow various combinations
            | []
            | [null | undefined]
            | [null | undefined, StrictSearchParams<T>]
            | [Record<string, never>]
            | [Record<string, never>, StrictSearchParams<T>]
      : // Has both required path params and search params
        [StrictPathParams<T>] | [StrictPathParams<T>, StrictSearchParams<T>];

export interface RouteOptions extends RoutePatternOptions {
    file?: string;
    isIndex?: boolean;
    isLayout?: boolean;
}

export class Route<Pattern extends string = string> extends RoutePattern<Pattern> {
    children?: RouteMap;
    #file?: string;
    #isIndex?: boolean;
    #isLayout?: boolean;

    constructor(source: Pattern | RoutePattern<Pattern>, options?: RouteOptions) {
        if (source instanceof RoutePattern) {
            super(source.source as Pattern, { ignoreCase: source.ignoreCase });
        } else {
            super(source, options);
        }

        if (options) {
            this.#file = options.file;
            this.#isIndex = options.isIndex;
            this.#isLayout = options.isLayout;
        }
    }

    get file(): string | undefined {
        return this.#file;
    }

    get isIndex(): boolean | undefined {
        return this.#isIndex;
    }

    get isLayout(): boolean | undefined {
        return this.#isLayout;
    }

    override href(...args: StrictHrefBuilderArgs<Pattern>): string {
        // Validate path params
        const pathParams = this.#getPathParams();
        const hasPathParams = pathParams.length > 0;
        const firstArgProvided = args.length > 0 && args[0] !== null && args[0] !== undefined;
        const pathParamsProvided = firstArgProvided && typeof args[0] === "object";

        // If no path params expected but a first argument is provided, throw
        if (!hasPathParams && firstArgProvided) {
            throw new Error(
                `Route "${this.source}" does not accept path parameters, but received: ${JSON.stringify(args[0])}`,
            );
        }

        // If path params expected but wrong ones provided
        if (hasPathParams && pathParamsProvided) {
            const provided = Object.keys(args[0] as object);
            for (const key of provided) {
                if (!pathParams.includes(key)) {
                    throw new Error(
                        `Invalid path parameter "${key}" for route "${this.source}". Valid parameters are: ${pathParams.join(", ")}`,
                    );
                }
            }
        }

        // Validate search params if provided
        if (args.length > 1 && args[1] && Object.keys(args[1]).length > 0) {
            const providedParams = args[1];
            const validParams = this.#getValidSearchParams();

            // Check if any provided param is not in the valid params list
            for (const key of Object.keys(providedParams)) {
                if (!validParams.includes(key)) {
                    throw new Error(
                        `Invalid search parameter "${key}" for route "${this.source}". Valid parameters are: ${validParams.join(", ")}`,
                    );
                }
            }
        }

        // Get the link from the parent class
        const link = super.href(...args);

        // If there are search params provided, use them; otherwise strip any empty query strings
        if (args.length > 1 && args[1] && Object.keys(args[1]).length > 0) {
            return link;
        }

        // Remove any trailing ? or query params that have no value
        return link.split("?")[0];
    }

    #getPathParams(): string[] {
        const pathPart = this.source.split("?")[0];
        const matches = pathPart.match(/:(\w+)/g);
        if (!matches) return [];
        return matches.map(m => m.slice(1)); // Remove the ':' prefix
    }

    #getValidSearchParams(): string[] {
        const searchPart = this.source.split("?")[1];
        if (!searchPart) return [];
        return searchPart.split("&");
    }

    toRouteConfig(): RouteConfigEntry | RouteConfigEntry[] {
        if (this.#isIndex && this.#file) {
            return rrIndex(this.#file);
        }

        if (this.#isLayout && this.#file) {
            const childConfigs = this.children
                ? Object.values(this.children).flatMap(child =>
                      child instanceof Route ? child.toRouteConfig() : [],
                  )
                : [];
            return rrLayout(this.#file, childConfigs);
        }

        if (this.#file) {
            // Extract the path part (remove search params for RR config)
            let path = this.source.split("?")[0];
            // Remove leading slash for React Router config
            path = path.replace(/^\//, "");

            // Don't recursively generate child configs here
            // They will be generated by createRoutes
            return rrRoute(path, this.#file);
        }

        // For prefix-only routes (no file)
        const childConfigs = this.children
            ? Object.values(this.children).flatMap(child =>
                  child instanceof Route ? child.toRouteConfig() : [],
              )
            : [];

        return childConfigs;
    }
}

export type Routes<T> = T & {
    [RouteConfig]: RouteConfigEntry | RouteConfigEntry[];
};

export function createRoutes<TRouteMap>(routeMap: TRouteMap): Routes<TRouteMap> {
    const {
        index: rrIndex,
        layout: rrLayout,
        route: rrRoute,
        prefix: rrPrefix,
    } = require("@react-router/dev/routes");

    const config: RouteConfigEntry[] = [];

    function processRouteMap(map: any): RouteConfigEntry[] {
        const entries: RouteConfigEntry[] = [];

        for (const [_key, value] of Object.entries(map)) {
            if (value instanceof Route) {
                // Simple route
                const config = value.toRouteConfig();
                if (Array.isArray(config)) {
                    entries.push(...config);
                } else {
                    entries.push(config);
                }
            } else if (typeof value === "object" && value !== null) {
                const valueAny = value as any;
                // Check for layout
                if (valueAny.__layoutFile) {
                    const layoutFile = valueAny.__layoutFile;
                    const childConfigs = Object.values(value)
                        .filter(v => v instanceof Route)
                        .flatMap(child => (child as Route).toRouteConfig());
                    entries.push(rrLayout(layoutFile, childConfigs));
                }
                // Check for prefix
                else if (valueAny.__prefix) {
                    const prefixPath = valueAny.__prefix;
                    // Use the original (non-prefixed) routes for config generation
                    const originalRoutes = valueAny.__originalRoutes || value;
                    const childConfigs = Object.values(originalRoutes)
                        .filter(v => v instanceof Route)
                        .flatMap(child => (child as Route).toRouteConfig());
                    entries.push(...rrPrefix(prefixPath, childConfigs));
                }
                // Check for resources/resource or route with children
                else if (valueAny.__parentPath && valueAny.__parentFile) {
                    const parentPath = valueAny.__parentPath;
                    const parentFile = valueAny.__parentFile;
                    const childRoutes = valueAny.__childRoutes || value;
                    const childConfigs = Object.values(childRoutes)
                        .filter(v => v instanceof Route)
                        .flatMap(child => (child as Route).toRouteConfig());
                    entries.push(rrRoute(parentPath, parentFile, childConfigs));
                }
            }
        }

        return entries;
    }

    config.push(...processRouteMap(routeMap));

    const result = routeMap as Routes<TRouteMap>;
    (result as any)[RouteConfig] = config;

    return result;
}

export function layout<Children extends RouteMap | undefined>(
    file: string,
    routeMap: Children,
): Children {
    // Store layout metadata directly on the route map to avoid circular references
    if (routeMap) {
        (routeMap as any).__layoutFile = file;
    }

    return routeMap;
}

export function index(file: string): Route<"/"> {
    return new Route("/", { file, isIndex: true });
}

// Split "path?search" into path/search pieces
export type PathPart<S extends string> = S extends `${infer P}?${string}` ? P : S;

export type SearchPart<S extends string> = S extends `${string}?${infer Q}` ? Q : never;

// Join two paths, avoiding "//" but always adding "/" between segments
export type JoinPaths<A extends string, B extends string> = A extends `${infer A2}/`
    ? B extends `/${infer B2}`
        ? `${A2}/${B2}`
        : `${A}${B}`
    : B extends `/${infer B2}`
      ? `${A}/${B2}`
      : `${A}/${B}`;

// Join search params with &
export type JoinSearch<A extends string, B extends string> = [A, B] extends [never, never]
    ? ""
    : [A] extends [never]
      ? `?${B}`
      : [B] extends [never]
        ? `?${A}`
        : `?${A}&${B}`;

// Compose two full patterns, joining paths and search separately
export type JoinPattern<
    Base extends string,
    Child extends string,
> = `${JoinPaths<PathPart<Base>, PathPart<Child>>}${JoinSearch<SearchPart<Base>, SearchPart<Child>>}`;

export type RouteObject = Record<string, any>;

// Rewrite every Route<P> inside T as Route<JoinPattern<Base, P>>
// and recursively descend into plain objects.
export type WithBase<Base extends string, T> = T extends Route<infer P>
    ? Route<JoinPattern<Base, P>>
    : T extends RouteObject
      ? { [K in keyof T]: WithBase<Base, T[K]> }
      : T;

// Helper to join two path patterns
function joinPatterns(base: string, child: string): string {
    // Split base and child into path and search parts
    const [basePath, baseSearch] = base.split("?");
    const [childPath, childSearch] = child.split("?");

    // Join paths
    let path: string;
    if (basePath.endsWith("/") && childPath.startsWith("/")) {
        path = basePath.slice(0, -1) + childPath;
    } else if (!basePath.endsWith("/") && !childPath.startsWith("/")) {
        path = `${basePath}/${childPath}`;
    } else {
        path = basePath + childPath;
    }

    // Join search params
    const searchParts = [baseSearch, childSearch].filter(Boolean);
    const search = searchParts.length > 0 ? `?${searchParts.join("&")}` : "";

    return path + search;
}

// Helper to apply a prefix to a route map
function applyPrefixToRouteMap(base: string, routeMap: RouteMap): RouteMap {
    const result: RouteMap = {};

    for (const [key, value] of Object.entries(routeMap)) {
        if (value instanceof Route) {
            // Join the patterns
            const newPattern = joinPatterns(base, value.source);
            const newRoute = new Route(newPattern, {
                file: value.file,
                isIndex: value.isIndex,
                isLayout: value.isLayout,
            });

            if (value.children) {
                newRoute.children = value.children;
            }

            result[key] = newRoute;
        } else {
            // Recursively apply prefix to nested route maps
            result[key] = applyPrefixToRouteMap(base, value);
        }
    }

    return result;
}

export function prefix<Prefix extends string, const Children extends RouteMap>(
    prefix: Prefix,
    routeMap: Children,
): WithBase<Prefix, Children> {
    const result = applyPrefixToRouteMap(prefix, routeMap) as WithBase<Prefix, Children>;
    // Mark this as a prefix for createRoutes to detect
    const [prefixPath] = prefix.split("?");
    (result as any).__prefix = prefixPath.replace(/^\//, "");
    // Store the original (non-prefixed) routes for config generation
    (result as any).__originalRoutes = routeMap;
    return result;
}

export function route<Pattern extends string>(prefix: Pattern, file: string): Route<Pattern>;
export function route<Prefix extends string, const Children extends RouteMap>(
    prefix: Prefix,
    file: string,
    routeMap: Children,
): WithBase<Prefix, Children>;
export function route(pattern: string, file: string, routeMap?: RouteMap): any {
    if (routeMap) {
        // Apply prefix to all children
        const prefixedChildren = applyPrefixToRouteMap(pattern, routeMap);
        // Store metadata without creating circular references
        const [path] = pattern.split("?");
        (prefixedChildren as any).__parentPath = path.replace(/^\//, "");
        (prefixedChildren as any).__parentFile = file;
        return prefixedChildren;
    }

    return new Route(pattern, { file });
}

export const ResourcesMethods = ["index", "new", "show", "edit"] as const;
export type ResourcesMethod = (typeof ResourcesMethods)[number];

export type ResourcesOptions = {
    /**
     * The resource methods to include in the route map. If not provided, all
     * methods (`index`, `show`, `new`, `edit`)
     * will be included.
     */
    only?: ResourcesMethod[];
    /**
     * The parameter name to use for the resource. Defaults to `id`.
     */
    param?: string;
    /**
     * Custom names to use for the resource routes.
     */
    names?: {
        index?: string;
        new?: string;
        show?: string;
        edit?: string;
    };
};

export type ResourcesMethodsFor<Options extends ResourcesOptions | undefined> = Options extends {
    only: readonly (infer M)[];
}
    ? M & ResourcesMethod
    : ResourcesMethod;

export type ResourcesKeyFor<
    M extends ResourcesMethod,
    Options extends ResourcesOptions | undefined,
> = Options extends { names: infer N }
    ? N extends Record<string, string>
        ? M extends keyof N
            ? N[M] & string
            : M
        : M
    : M;

export type ResourcesParamFor<Options extends ResourcesOptions | undefined> = Options extends {
    param: infer P extends string;
}
    ? P
    : "id";

export type ResourcesRouteFor<
    Base extends string,
    Param extends string,
    M extends ResourcesMethod,
> = M extends "index"
    ? Route<Base>
    : M extends "new"
      ? Route<JoinPattern<Base, "/new">>
      : M extends "show"
        ? Route<JoinPattern<Base, `/:${Param}`>>
        : M extends "edit"
          ? Route<JoinPattern<Base, `/:${Param}/edit`>>
          : never;

export type ResourcesMap<Base extends string, Options extends ResourcesOptions | undefined> = {
    [M in ResourcesMethodsFor<Options> as ResourcesKeyFor<M, Options>]: ResourcesRouteFor<
        Base,
        ResourcesParamFor<Options>,
        M
    >;
};

export function resources<Base extends string, const Options extends ResourcesOptions>(
    base: Base | RoutePattern<Base>,
    options?: Options,
): ResourcesMap<Base, Options> {
    const baseStr = base instanceof RoutePattern ? base.source : base;
    const [basePath, searchParams] = baseStr.split("?");
    const _search = searchParams ? `?${searchParams}` : "";

    const param = options?.param || "id";
    const only = options?.only || ["index", "new", "show", "edit"];
    const names = options?.names || {};

    // Extract the base name from the path (e.g., "/artists" -> "artists")
    const baseName = basePath.replace(/^\//, "").split("/").pop() || "";
    const layoutFile = `./${baseName}/layout.tsx`;

    const result: any = {};
    const childRoutes: any = {};

    for (const method of only) {
        const key = (names as any)[method] || method;

        if (method === "index") {
            // Index route is a child of the layout
            const childRoute = new Route("", { file: `./${baseName}/index.tsx`, isIndex: true });
            childRoutes[key] = childRoute;
            // The result route has the full path for user access
            result[key] = new Route(baseStr, { file: `./${baseName}/index.tsx`, isIndex: true });
        } else if (method === "new") {
            // Child route is relative
            const childRoute = new Route("new", { file: `./${baseName}/new.tsx` });
            childRoutes[key] = childRoute;
            result[key] = new Route(joinPatterns(baseStr, "/new"), {
                file: `./${baseName}/new.tsx`,
            });
        } else if (method === "show") {
            const childRoute = new Route(`:${param}`, { file: `./${baseName}/show.tsx` });
            childRoutes[key] = childRoute;
            result[key] = new Route(joinPatterns(baseStr, `/:${param}`), {
                file: `./${baseName}/show.tsx`,
            });
        } else if (method === "edit") {
            const childRoute = new Route(`:${param}/edit`, { file: `./${baseName}/edit.tsx` });
            childRoutes[key] = childRoute;
            result[key] = new Route(joinPatterns(baseStr, `/:${param}/edit`), {
                file: `./${baseName}/edit.tsx`,
            });
        }
    }

    // Store parent metadata and child routes separately without creating circular references
    (result as any).__parentPath = basePath.replace(/^\//, "");
    (result as any).__parentFile = layoutFile;
    (result as any).__childRoutes = childRoutes;

    return result;
}

export const ResourceMethods = ["new", "show", "edit"] as const;
export type ResourceMethod = (typeof ResourceMethods)[number];

export interface ResourceOptions {
    /**
     * The resource methods to include in the route map. If not provided, all
     * methods (`show`, `new`, and `edit`) will be
     * included.
     */
    only?: ResourceMethod[];
    /**
     * Custom names to use for the resource routes.
     */
    names?: {
        new?: string;
        show?: string;
        edit?: string;
    };
}

export type ResourceMethodsFor<Options extends ResourceOptions | undefined> = Options extends {
    only: readonly (infer M)[];
}
    ? M & ResourceMethod
    : ResourceMethod;

export type ResourceKeyFor<
    M extends ResourceMethod,
    Options extends ResourceOptions | undefined,
> = Options extends { names: infer N }
    ? N extends Record<string, string>
        ? M extends keyof N
            ? N[M] & string
            : M
        : M
    : M;

export type ResourceRouteFor<Base extends string, M extends ResourceMethod> = M extends "new"
    ? Route<JoinPattern<Base, "/new">>
    : M extends "show"
      ? Route<Base>
      : M extends "edit"
        ? Route<JoinPattern<Base, "/edit">>
        : never;

export type ResourceMap<Base extends string, Options extends ResourceOptions | undefined> = {
    [M in ResourceMethodsFor<Options> as ResourceKeyFor<M, Options>]: ResourceRouteFor<Base, M>;
};

export function resource<Base extends string, const Options extends ResourceOptions>(
    base: Base | RoutePattern<Base>,
    options?: Options,
): ResourceMap<Base, Options> {
    const baseStr = base instanceof RoutePattern ? base.source : base;
    const [basePath, searchParams] = baseStr.split("?");
    const _search = searchParams ? `?${searchParams}` : "";

    const only = options?.only || ["new", "show", "edit"];
    const names = options?.names || {};

    // Extract the base name from the path (e.g., "/user" -> "user")
    const baseName = basePath.replace(/^\//, "").split("/").pop() || "";
    const layoutFile = `./${baseName}/layout.tsx`;

    const result: any = {};
    const childRoutes: any = {};

    // Process in the order: show (index), new, edit
    // This ensures the config is generated in the correct order
    const orderedMethods = ["show", "new", "edit"].filter(m => only.includes(m as ResourceMethod));

    for (const method of orderedMethods) {
        const key = (names as any)[method] || method;

        if (method === "show") {
            // For resource, "show" becomes an index route (child)
            const childRoute = new Route("", { file: `./${baseName}/show.tsx`, isIndex: true });
            childRoutes[key] = childRoute;
            result[key] = new Route(baseStr, { file: `./${baseName}/show.tsx` });
        } else if (method === "new") {
            const childRoute = new Route("new", { file: `./${baseName}/new.tsx` });
            childRoutes[key] = childRoute;
            result[key] = new Route(joinPatterns(baseStr, "/new"), {
                file: `./${baseName}/new.tsx`,
            });
        } else if (method === "edit") {
            const childRoute = new Route("edit", { file: `./${baseName}/edit.tsx` });
            childRoutes[key] = childRoute;
            result[key] = new Route(joinPatterns(baseStr, "/edit"), {
                file: `./${baseName}/edit.tsx`,
            });
        }
    }

    // Store parent metadata and child routes separately without creating circular references
    (result as any).__parentPath = basePath.replace(/^\//, "");
    (result as any).__parentFile = layoutFile;
    (result as any).__childRoutes = childRoutes;

    return result;
}
