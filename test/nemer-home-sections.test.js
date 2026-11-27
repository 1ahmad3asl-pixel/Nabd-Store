"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "pages/index.html"), "utf8");
const map = JSON.parse(fs.readFileSync(path.join(root, "config/nemer-category-map.json"), "utf8"));
const topology = map.sectionTopology;

test("Nabd-Store homepage mirrors all 20 Nemer top-level sections one-to-one", () => {
    const tiles = [...html.matchAll(
        /<button class="category category-tile" data-category="([^"]+)" data-category-title="([^"]+)" type="button">[\s\S]*?<\/button>/g
    )].map((match) => ({ key: match[1], title: match[2] }));

    assert.equal(topology.supplierMainCategoryCount, 20);
    assert.equal(topology.storeMainSectionCount, 20);
    assert.equal(topology.supplierMainCategoryNames.length, 20);
    assert.equal(topology.storeSections.length, 20);
    assert.equal(topology.supplierToStoreMappings.length, 20);
    assert.equal(tiles.length, 20);

    assert.deepEqual(
        tiles.map((tile) => tile.title),
        topology.supplierMainCategoryNames
    );
    assert.deepEqual(tiles, topology.storeSections);

    const keys = tiles.map((tile) => tile.key);
    assert.equal(new Set(keys).size, 20, "each supplier section must have a unique store key");

    assert.deepEqual(
        topology.supplierToStoreMappings.map((item) => ({
            key: item.storeKey,
            title: item.storeTitle
        })),
        tiles
    );
    assert.deepEqual(
        topology.supplierToStoreMappings.map((item) => item.supplierName),
        topology.supplierMainCategoryNames
    );
});

test("the two restored supplier sections have dedicated homepage entries", () => {
    const keys = [...html.matchAll(
        /<button class="category category-tile" data-category="([^"]+)"/g
    )].map((match) => match[1]);

    assert.ok(keys.includes("apps"));
    assert.ok(keys.includes("shamcash"));
});

test("all 20 homepage section tiles use existing local GitHub assets", () => {
    const tiles = [...html.matchAll(
        /<button class="category category-tile"[^>]*>[\\s\\S]*?<\\/button>/g
    )].map((match) => match[0]);

    assert.equal(tiles.length, 20);
    for (const tile of tiles) {
        const image = tile.match(/<img src="([^"]+)"/);
        assert.ok(image, "each section tile must have an image");
        const relativePath = image[1].replace(/^\\/+/, "");
        assert.ok(
            fs.existsSync(path.join(root, relativePath)),
            `missing local category image: ${image[1]}`
        );
    }
});
