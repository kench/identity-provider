const ENV = 'ALLOWLIST_TABLE';

describe('allowlistTable', () => {
  afterEach(() => {
    delete process.env[ENV];
  });

  function freshModule(): typeof import('../lambda/allowlist_table') {
    let module: typeof import('../lambda/allowlist_table') | undefined;
    jest.isolateModules(() => {
      module = require('../lambda/allowlist_table');
    });
    return module!;
  }

  it('reads the table named by ALLOWLIST_TABLE, once', () => {
    process.env[ENV] = 'identity-provider-allowlist';
    const {ALLOWLIST_TABLE_ENV, allowlistTable} = freshModule();
    expect(ALLOWLIST_TABLE_ENV).toBe(ENV);
    const allowlist = allowlistTable();
    // A class from the isolated module registry, so compared by name.
    expect(allowlist.constructor.name).toBe('TableAllowlist');
    expect(allowlistTable()).toBe(allowlist);
  });

  it('fails without ALLOWLIST_TABLE', () => {
    expect(() => freshModule().allowlistTable()).toThrow(
      "ALLOWLIST_TABLE isn't set",
    );
  });
});
