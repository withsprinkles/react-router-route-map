import { beforeAll, describe, expect, expectTypeOf, test } from "bun:test";
import {
    index as rrIndex,
    layout as rrLayout,
    prefix as rrPrefix,
    route as rrRoute,
} from "@react-router/dev/routes";
import {
    createRoutes,
    index,
    layout,
    prefix,
    type Route,
    RouteConfig,
    type Routes,
    resource,
    resources,
    route,
} from "./index.ts";

const routeMap = {
    index: index("./home.tsx"),
    about: route("/about", "./about.tsx"),
    auth: layout("./auth/layout.tsx", {
        login: route("/login", "./auth/login.tsx"),
        register: route("/register", "./auth/register.tsx"),
    }),
    concerts: prefix("/concerts?q", {
        home: index("./concerts/home.tsx"),
        show: route("/:city", "./concerts/city.tsx"),
        trending: route("/trending?in-my-town", "./concerts/trending.tsx"),
    }),
    artists: resources("/artists?q", {
        only: ["index", "show"],
        param: "name",
    }),
    user: resource("/user"),
    nested: {
        some: route("/some-route", "./some-route.tsx"),
        other: route("/other-route", "./other-route.tsx"),
    },
};

type RoutesType = Routes<typeof routeMap>;
let routes: RoutesType;

beforeAll(async () => {
    routes = await createRoutes(routeMap);
});

test("generates correct React Router config", () => {
    expect(routes[RouteConfig]).toEqual([
        rrIndex("./home.tsx"),
        rrRoute("about", "./about.tsx"),

        rrLayout("./auth/layout.tsx", [
            rrRoute("login", "./auth/login.tsx"),
            rrRoute("register", "./auth/register.tsx"),
        ]),

        ...rrPrefix("concerts", [
            rrIndex("./concerts/home.tsx"),
            rrRoute(":city", "./concerts/city.tsx"),
            rrRoute("trending", "./concerts/trending.tsx"),
        ]),

        rrRoute("artists", "./artists/layout.tsx", [
            rrIndex("./artists/index.tsx"),
            rrRoute(":name", "./artists/show.tsx"),
        ]),

        rrRoute("user", "./user/layout.tsx", [
            rrIndex("./user/show.tsx"),
            rrRoute("new", "./user/new.tsx"),
            rrRoute("edit", "./user/edit.tsx"),
        ]),

        rrRoute("/some-route", "./some-route.tsx"),
        rrRoute("/other-route", "./other-route.tsx"),
    ]);
});

describe("type-level tests", () => {
    test("generates correct TypeScript types", () => {
        expectTypeOf(routes.index).toExtend<Route<"/">>();
        expectTypeOf(routes.concerts.trending).toExtend<Route<"/concerts/trending?q&in-my-town">>();
        expectTypeOf(routes.concerts.show).toExtend<Route<"/concerts/:city?q">>();
        expectTypeOf(routes.artists.index).toExtend<Route<"/artists?q">>();
        expectTypeOf(routes.artists.show).toExtend<Route<"/artists/:name?q">>();
        expectTypeOf(routes.user.new).toExtend<Route<"/user/new">>();
    });

    test("rejects incorrect href path or search parameters", () => {
        expect(() => {
            // @ts-expect-error TEST: "b" is not a possible search param for this route
            routes.artists.show.href({ name: "haim" }, { q: "Austin", b: "b" });
        }).toThrow();

        expect(() => {
            // @ts-expect-error TEST: `routes.concerts.trending` does not accept path params
            routes.concerts.trending.href("foo", { q: "rock", "in-my-town": true });
        }).toThrow();

        expect(() => {
            // @ts-expect-error TEST: `routes.concerts.show` does not accept the `concert` path param
            routes.concerts.show.href({ concert: "salt-lake-city" });
        }).toThrow();

        expect(() => {
            // @ts-expect-error TEST: `routes.user.show` does not accept search params
            routes.user.show.href(null, { q: "Mark" });
        }).toThrow();
    });
});

describe("generates correct href values", () => {
    test("index", () => {
        const href = routes.index.href();
        expect(href).toEqual("/");
    });

    test("prefix with search params", () => {
        const href = routes.concerts.trending.href(null, { q: "rock", "in-my-town": true });
        expect(href).toEqual("/concerts/trending?q=rock&in-my-town=true");
    });

    test("prefix with path params", () => {
        const href = routes.concerts.show.href({ city: "salt-lake-city" });
        expect(href).toEqual("/concerts/salt-lake-city");
    });

    test("resources.index with search params", () => {
        const href = routes.artists.index.href(null, { q: "Mark" });
        expect(href).toEqual("/artists?q=Mark");
    });

    test("resources.show with search params", () => {
        const href = routes.artists.show.href({ name: "haim" }, { q: "Austin" });
        expect(href).toEqual("/artists/haim?q=Austin");
    });

    test("resource.new", () => {
        const href = routes.user.new.href();
        expect(href).toEqual("/user/new");
    });

    test("resource.show", () => {
        const href = routes.user.show.href();
        expect(href).toEqual("/user");
    });

    test("resource.edit", () => {
        const href = routes.user.edit.href();
        expect(href).toEqual("/user/edit");
    });
});
