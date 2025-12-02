# @withsprinkles/react-router-route-map

A type-safe route mapping library for [React Router](https://reactrouter.com) that provides declarative route definitions with compile-time validation. Inspired by [`@remix-run/fetch-router`](https://github.com/remix-run/remix/tree/main/packages/fetch-router).

## Features

- **Type-Safe Navigation**: Leverage TypeScript for compile-time route validation and parameter inference
- **Declarative Route Maps**: Define your entire route structure upfront with type-safe route names
- **Composable Architecture**: Nest routes, combine layouts, and organize routes hierarchically
- **Resource-Based Routing**: Built-in helpers for RESTful route patterns
- **React Router Integration**: Seamlessly generates React Router v7 route configurations

## Goals

- **Type Safety**: Catch routing errors at compile time, not runtime
- **Simplicity**: A declarative API that fits in your head
- **Standards-Based**: Built on React Router's conventions and best practices

## Installation

```sh
# Install with npm
npm add @withsprinkles/react-router-route-map
```

```sh
# Install with yarn
yarn add @withsprinkles/react-router-route-map
```

```sh
# Install with pnpm
pnpm add @withsprinkles/react-router-route-map
```

```sh
# Install with Deno
deno add npm:@withsprinkles/react-router-route-map
```

```sh
# Install with Bun
bun add @withsprinkles/react-router-route-map
```

## Peer Dependencies

This library requires:

- `@react-router/dev` v7.0.0 or higher
- `@remix-run/route-pattern` v0.15.3 or higher

## Usage

The main purpose of the route map is to organize your routes by name and provide type-safe navigation throughout your application. The route map structure mirrors your application's routing hierarchy and provides compile-time validation for route parameters and navigation.

### Basic Example

Here's a simple application with a home page, an about page, and a blog:

```ts
import { createRoutes, index, route } from "@withsprinkles/react-router-route-map";

// Define your route map with named routes
export const routes = createRoutes({
    home: index("./home.tsx"),
    about: route("/about", "./about.tsx"),
    blog: {
        index: route("/blog", "./blog/index.tsx"),
        show: route("/blog/:slug", "./blog/show.tsx"),
    },
});

// Export the React Router config
export default routes[RouteConfig];
```

The route map is an object where keys are route names and values are `Route` objects. You can inspect the types:

```ts
type Routes = typeof routes;
// {
//   home: Route<'/'>
//   about: Route<'/about'>
//   blog: {
//     index: Route<'/blog'>
//     show: Route<'/blog/:slug'>
//   }
// }
```

### Type-Safe Navigation

The route map makes it easy to generate type-safe links and navigation throughout your application using the `href()` method on routes:

```tsx
import { Link } from "react-router";
import { routes } from "./routes";

export default function Home() {
    return (
        <div>
            <h1>Welcome</h1>
            <nav>
                <Link to={routes.about.href()}>About Us</Link>
                <Link to={routes.blog.index.href()}>Blog</Link>
            </nav>
        </div>
    );
}
```

Routes with parameters are fully type-checked:

```tsx
import { Link } from "react-router";
import { routes } from "./routes";

export default function BlogIndex() {
    const posts = [
        { slug: "hello-world", title: "Hello World" },
        { slug: "typescript-tips", title: "TypeScript Tips" },
    ];

    return (
        <div>
            <h1>Blog Posts</h1>
            {posts.map(post => (
                <Link key={post.slug} to={routes.blog.show.href({ slug: post.slug })}>
                    {post.title}
                </Link>
            ))}
        </div>
    );
}
```

### Route Configuration

Use `createRoutes()` to convert your route map into a React Router configuration:

```ts
import { createRoutes, RouteConfig } from "@withsprinkles/react-router-route-map";

const routes = createRoutes({
    // ... your route map
});

// In your app/routes.ts file for React Router v7:
export default routes[RouteConfig];
```

This generates the standard React Router configuration that you would normally write by hand:

```ts
import { route, index } from "@react-router/dev/routes";

export default [
    index("./home.tsx"),
    route("about", "./about.tsx"),
    route("blog", "./blog/index.tsx"),
    route("blog/:slug", "./blog/show.tsx"),
];
```

### Nested Routes and Layouts

Routes can be nested inside layout routes to share UI and logic:

```ts
import { createRoutes, index, route, layout } from "@withsprinkles/react-router-route-map";

export const routes = createRoutes({
    home: index("./home.tsx"),

    // Layout route wraps children with shared UI
    auth: layout("./auth/layout.tsx", {
        login: route("/login", "./auth/login.tsx"),
        register: route("/register", "./auth/register.tsx"),
    }),

    dashboard: layout("./dashboard/layout.tsx", {
        index: index("./dashboard/index.tsx"),
        settings: route("/settings", "./dashboard/settings.tsx"),
    }),
});
```

The layout component renders child routes through the `<Outlet />` component:

```tsx
// app/auth/layout.tsx
import { Outlet } from "react-router";

export default function AuthLayout() {
    return (
        <div className="auth-container">
            <header>
                <h1>My App</h1>
            </header>
            <main>
                <Outlet />
            </main>
        </div>
    );
}
```

### Route Prefixes

Use `prefix()` to add a path prefix to a group of routes without creating a parent route:

```ts
import { createRoutes, index, route, prefix } from "@withsprinkles/react-router-route-map";

export const routes = createRoutes({
    home: index("./home.tsx"),

    // All these routes will be prefixed with /concerts
    concerts: prefix("/concerts", {
        index: index("./concerts/index.tsx"),
        show: route("/:city", "./concerts/city.tsx"),
        trending: route("/trending", "./concerts/trending.tsx"),
    }),
});

// Generates URLs:
// routes.concerts.index.href() -> '/concerts'
// routes.concerts.show.href({ city: 'austin' }) -> '/concerts/austin'
// routes.concerts.trending.href() -> '/concerts/trending'
```

Note that `prefix()` modifies the paths but doesn't introduce a new route into the tree. These two route maps are equivalent:

```ts
// Using prefix():
prefix('/parent', {
  child1: route('/child1', './child1.tsx'),
  child2: route('/child2', './child2.tsx'),
})

// Without prefix:
{
  child1: route('/parent/child1', './child1.tsx'),
  child2: route('/parent/child2', './child2.tsx'),
}
```

### Resource-Based Routes

The library provides `resources()` and `resource()` helpers for creating RESTful route patterns, similar to [Rails' resource routing](https://guides.rubyonrails.org/routing.html#resource-routing-the-rails-default).

#### Resources (Collections)

Use `resources()` to create routes for a collection of resources:

```ts
import { createRoutes, resources } from "@withsprinkles/react-router-route-map";

export const routes = createRoutes({
    users: resources("/users"),
});

type Routes = typeof routes.users;
// {
//   index: Route<'/users'>        - Lists all users
//   new: Route<'/users/new'>      - Form to create a new user
//   show: Route<'/users/:id'>     - Shows a single user
//   edit: Route<'/users/:id/edit'> - Form to edit a user
// }
```

By default, `resources()` generates four routes. You can customize which routes are generated:

```ts
export const routes = createRoutes({
    // Only generate index and show routes
    users: resources("/users", {
        only: ["index", "show"],
    }),

    // Customize the parameter name (default is 'id')
    artists: resources("/artists", {
        only: ["index", "show"],
        param: "artistId",
    }),

    // Customize route names
    products: resources("/products", {
        only: ["index", "show", "edit"],
        names: {
            index: "list",
            show: "view",
            edit: "update",
        },
    }),
});

// routes.users.show.href({ id: '123' }) -> '/users/123'
// routes.artists.show.href({ artistId: 'haim' }) -> '/artists/haim'
// routes.products.list.href() -> '/products'
// routes.products.update.href({ id: '456' }) -> '/products/456/edit'
```

#### Resource (Singleton)

Use `resource()` to create routes for a singleton resource (not part of a collection):

```ts
import { createRoutes, resource } from "@withsprinkles/react-router-route-map";

export const routes = createRoutes({
    profile: resource("/profile"),
});

type Routes = typeof routes.profile;
// {
//   new: Route<'/profile/new'>   - Form to create the profile
//   show: Route<'/profile'>      - Shows the profile
//   edit: Route<'/profile/edit'> - Form to edit the profile
// }
```

Note that `resource()` doesn't have an `index` route (since it's not a collection) and routes don't include an `:id` parameter.

You can customize resource routes similarly to resources:

```ts
export const routes = createRoutes({
    account: resource("/account", {
        only: ["show", "edit"],
        names: {
            show: "view",
            edit: "settings",
        },
    }),
});

// routes.account.view.href() -> '/account'
// routes.account.settings.href() -> '/account/edit'
```

#### Nested Resources

Resources and regular routes can be nested together:

```ts
export const routes = createRoutes({
    users: {
        ...resources("/users", { only: ["index", "show"] }),
        profile: resource("/users/:userId/profile", { only: ["show", "edit"] }),
    },
});

// routes.users.index.href() -> '/users'
// routes.users.show.href({ id: '123' }) -> '/users/123'
// routes.users.profile.show.href({ userId: '123' }) -> '/users/123/profile'
// routes.users.profile.edit.href({ userId: '123' }) -> '/users/123/profile/edit'
```

### Search Parameters

Routes can include search parameters in their pattern, providing type-safe query string handling:

```ts
import { createRoutes, route, prefix } from "@withsprinkles/react-router-route-map";

export const routes = createRoutes({
    search: route("/search?q", "./search.tsx"),

    products: prefix("/products?category", {
        index: route("/?sort", "./products/index.tsx"),
        show: route("/:id?variant", "./products/show.tsx"),
    }),
});

// Type-safe search parameter usage:
routes.search.href(null, { q: "laptops" });
// -> '/search?q=laptops'

routes.products.index.href(null, { category: "electronics", sort: "price" });
// -> '/products?category=electronics&sort=price'

routes.products.show.href({ id: "123" }, { category: "electronics", variant: "blue" });
// -> '/products/123?category=electronics&variant=blue'

// TypeScript will error on invalid parameters:
routes.search.href(null, { invalid: "param" });
//                         ^^^^^^^^ Type error!
```

### Dynamic Segments

If a path segment starts with `:`, it becomes a dynamic segment. The type system automatically extracts these parameters:

```ts
import { createRoutes, route } from "@withsprinkles/react-router-route-map";

export const routes = createRoutes({
    team: route("/teams/:teamId", "./team.tsx"),
    product: route("/c/:categoryId/p/:productId", "./product.tsx"),
});

// Type-safe parameter access:
routes.team.href({ teamId: "123" });
// -> '/teams/123'

routes.product.href({ categoryId: "electronics", productId: "456" });
// -> '/c/electronics/p/456'

// TypeScript will error on missing or incorrect parameters:
routes.team.href({ wrong: "123" });
//                 ^^^^^ Type error!

routes.product.href({ categoryId: "electronics" });
//              ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ Type error: missing productId!
```

### Optional Segments

You can make a route segment optional by adding a `?` to the end:

```ts
import { createRoutes, route } from "@withsprinkles/react-router-route-map";

export const routes = createRoutes({
    categories: route("/:lang?/categories", "./categories.tsx"),
    user: route("/users/:userId/edit?", "./user.tsx"),
});

// Both of these work:
routes.categories.href();
// -> '/categories'

routes.categories.href({ lang: "es" });
// -> '/es/categories'
```

### Route Files and Modules

Each route points to a file that exports the route's behavior. See the [React Router documentation on route modules](https://reactrouter.com/start/framework/routing#route-modules) for details on loaders, actions, and components.

Example route module:

```tsx
// app/blog/show.tsx
import type { Route } from "./+types/show";

// Loader runs on the server to fetch data
export async function loader({ params }: Route.LoaderArgs) {
    const post = await fetchBlogPost(params.slug);
    return { post };
}

// Component renders with the loader data
export default function BlogPost({ loaderData }: Route.ComponentProps) {
    return (
        <article>
            <h1>{loaderData.post.title}</h1>
            <div>{loaderData.post.content}</div>
        </article>
    );
}
```

## API Reference

### `createRoutes(routeMap)`

Converts a route map into a typed route structure with React Router configuration.

```ts
const routes = createRoutes({
    home: index("./home.tsx"),
    about: route("/about", "./about.tsx"),
});

// Access routes
routes.home.href(); // -> '/'
routes.about.href(); // -> '/about'

// Get React Router config
export default routes[RouteConfig];
```

### `index(file)`

Creates an index route that renders at its parent's path:

```ts
index("./home.tsx");
// Creates Route<'/'>
```

### `route(pattern, file)`

Creates a route with a specific path pattern:

```ts
route("/about", "./about.tsx");
// Creates Route<'/about'>

route("/blog/:slug", "./blog/show.tsx");
// Creates Route<'/blog/:slug'>
```

### `route(pattern, file, children)`

Creates a route with child routes:

```ts
route("/dashboard", "./dashboard/layout.tsx", {
    settings: route("/settings", "./dashboard/settings.tsx"),
    profile: route("/profile", "./dashboard/profile.tsx"),
});
```

### `layout(file, children)`

Creates a layout route that wraps children without adding URL segments:

```ts
layout("./auth/layout.tsx", {
    login: route("/login", "./auth/login.tsx"),
    register: route("/register", "./auth/register.tsx"),
});
```

### `prefix(prefix, children)`

Adds a path prefix to child routes:

```ts
prefix("/admin", {
    dashboard: route("/dashboard", "./admin/dashboard.tsx"),
    users: route("/users", "./admin/users.tsx"),
});

// Generates:
// - /admin/dashboard
// - /admin/users
```

### `resources(base, options?)`

Creates resource routes for a collection:

```ts
resources('/users', {
  only?: ['index', 'new', 'show', 'edit'],
  param?: 'id',  // default parameter name
  names?: {
    index?: 'list',
    new?: 'create',
    show?: 'view',
    edit?: 'update',
  },
})
```

Generates routes:

- `index`: `GET /users` - Lists all resources
- `new`: `GET /users/new` - Form to create a resource
- `show`: `GET /users/:id` - Shows a single resource
- `edit`: `GET /users/:id/edit` - Form to edit a resource

### `resource(base, options?)`

Creates resource routes for a singleton:

```ts
resource('/profile', {
  only?: ['new', 'show', 'edit'],
  names?: {
    new?: 'create',
    show?: 'view',
    edit?: 'update',
  },
})
```

Generates routes:

- `new`: `GET /profile/new` - Form to create the resource
- `show`: `GET /profile` - Shows the resource
- `edit`: `GET /profile/edit` - Form to edit the resource

### `Route#href(...args)`

Generates a type-safe URL for the route:

```ts
// No parameters
route.href();

// Path parameters only
route.href({ id: "123" });

// Path and search parameters
route.href({ id: "123" }, { sort: "name" });

// Search parameters only (for routes without path params)
route.href(null, { q: "search" });
```

TypeScript will validate that:

- Required path parameters are provided
- Parameter names match the route pattern
- Search parameter names match the pattern (if specified)

## Comparison with React Router

### Standard React Router

```tsx
// app/routes.ts
import { route, index, layout, prefix } from "@react-router/dev/routes";

export default [
    index("./home.tsx"),
    route("about", "./about.tsx"),
    route("blog", "./blog/index.tsx"),
    route("blog/:slug", "./blog/show.tsx"),
];

// app/home.tsx
import { Link } from "react-router";

export default function Home() {
    // No type safety - easy to make mistakes
    return <Link to="/blog/hello-world">Blog Post</Link>;
}
```

### With react-router-route-map

```tsx
// app/routes.ts
import { createRoutes, index, route, RouteConfig } from "@withsprinkles/react-router-route-map";

export const routes = createRoutes({
    home: index("./home.tsx"),
    about: route("/about", "./about.tsx"),
    blog: {
        index: route("/blog", "./blog/index.tsx"),
        show: route("/blog/:slug", "./blog/show.tsx"),
    },
});

export default routes[RouteConfig];

// app/home.tsx
import { Link } from "react-router";
import { routes } from "./routes";

export default function Home() {
    // Fully type-safe - catches errors at compile time
    return <Link to={routes.blog.show.href({ slug: "hello-world" })}>Blog Post</Link>;
}
```

## Benefits of Route Maps

1. **Type Safety**: Catch routing errors at compile time instead of runtime
2. **Refactor with Confidence**: Change route patterns in one place, TypeScript ensures all usages are updated
3. **IDE Support**: Autocomplete for route names and parameters
4. **Self-Documenting**: Route map serves as documentation for your app's structure
5. **Centralized Configuration**: All routes defined in one place
6. **No Magic Strings**: Replace hardcoded URLs with typed route references

## License

[MIT](./LICENSE)

## Related Work

- [React Router](https://reactrouter.com/) - The routing library this builds upon
- [@remix-run/fetch-router](https://github.com/remix-run/remix/tree/main/packages/fetch-router) - The inspiration for this library's route map pattern
- [@remix-run/route-pattern](https://github.com/remix-run/remix/tree/main/packages/route-pattern) - The pattern matching library used internally
