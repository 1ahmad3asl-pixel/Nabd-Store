const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const boostSource = fs.readFileSync(require.resolve("../js/boost.js"), "utf8");
const homeSource = fs.readFileSync(require.resolve("../pages/index.html"), "utf8");
const imageDir = path.join(__dirname, "..", "public", "images", "رشـق صفحات");

test("homepage can open the boost category through its delegated click handler", () => {
  assert.match(boostSource, /window\.openBoost\s*=\s*openBoost/);
  assert.match(homeSource, /boost\.js\?v=20261125-boost2/);
  assert.match(homeSource, /boost\.css\?v=20261125-boost1/);
});

test("Snapchat uses the shared product picker with API fields and its centered app image", () => {
  assert.match(boostSource, /g\.key===\"snapchat\"/);
  assert.match(boostSource, /renderGameProductPicker\(g\.title,\{title:g\.title,products:list\},\{image:\"\/public\/images\/رشـق صفحات\/snapchat\.jpg\"/);
  assert.match(boostSource, /onBack:\(\)=>openBoost\(false\)/);
  assert.match(homeSource, /app\.js\?v=20261125-order1/);
});

test("boost platform categories render their named JPG image placeholders", () => {
  const platforms = ["snapchat", "kwai", "facebook", "whatsapp", "instagram", "telegram", "tiktok", "youtube"];

  for (const platform of platforms) {
    assert.match(boostSource, new RegExp(`key:\\"${platform}\\"`));
    assert.ok(boostSource.includes(`image:\"${platform}.jpg\"`), `${platform} category declares its JPG image`);

    const image = fs.readFileSync(path.join(imageDir, `${platform}.jpg`));
    assert.equal(image[0], 0xff, `${platform} placeholder has a JPEG start marker`);
    assert.equal(image[1], 0xd8, `${platform} placeholder has a JPEG start marker`);
    assert.equal(image[image.length - 2], 0xff, `${platform} placeholder has a JPEG end marker`);
    assert.equal(image[image.length - 1], 0xd9, `${platform} placeholder has a JPEG end marker`);
  }

  assert.match(boostSource, /src="\/public\/images\/رشـق صفحات\/\s*\x27\+esc\(g\.image\)/);
  assert.match(boostSource, /boost-category-image/);
});
