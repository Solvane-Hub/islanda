import { describe, expect, it } from 'vitest';
import { hostedTestTargetError } from '../../../scripts/ci/hosted-test-target';
import { PRODUCTION_PROJECT_REF } from '../../rls/client';

const TEST_REF = 'abcdefghijklmnopqrst';
const testUrl = `https://${TEST_REF}.supabase.co`;
const productionUrl = `https://${PRODUCTION_PROJECT_REF}.supabase.co`;

describe('hostedTestTargetError — hosted CI database guard (risk A4)', () => {
  it('allows only the declared non-production project', () => {
    expect(hostedTestTargetError(testUrl, TEST_REF)).toBeNull();
    expect(hostedTestTargetError(`${testUrl}/`, ` ${TEST_REF} `)).toBeNull();
  });

  it('refuses when no test project is declared, even for a non-production URL', () => {
    expect(hostedTestTargetError(testUrl, undefined)).toMatch(/not set/);
    expect(hostedTestTargetError(testUrl, '')).toMatch(/not set/);
    expect(hostedTestTargetError(testUrl, 'enabled')).toMatch(/not set/);
  });

  it('refuses the production project however it is supplied', () => {
    expect(hostedTestTargetError(productionUrl, PRODUCTION_PROJECT_REF)).toMatch(/production/);
    expect(hostedTestTargetError(productionUrl, TEST_REF)).toMatch(/production/);
    expect(
      hostedTestTargetError(
        `https://${TEST_REF}.supabase.co.${PRODUCTION_PROJECT_REF}.example`,
        TEST_REF,
      ),
    ).toMatch(/production/);
  });

  it('refuses a URL that is not exactly the declared project', () => {
    expect(hostedTestTargetError('https://zyxwvutsrqponmlkjihg.supabase.co', TEST_REF)).toMatch(
      /does not point/,
    );
    expect(hostedTestTargetError(`http://${TEST_REF}.supabase.co`, TEST_REF)).toMatch(
      /does not point/,
    );
    expect(hostedTestTargetError(`https://${TEST_REF}.supabase.co.evil.example`, TEST_REF)).toMatch(
      /does not point/,
    );
    expect(hostedTestTargetError('https://placeholder.supabase.co', TEST_REF)).toMatch(
      /does not point/,
    );
  });

  it('refuses a missing or malformed URL', () => {
    expect(hostedTestTargetError(undefined, TEST_REF)).toMatch(/not a valid URL/);
    expect(hostedTestTargetError('', TEST_REF)).toMatch(/not a valid URL/);
    expect(hostedTestTargetError('not a url', TEST_REF)).toMatch(/not a valid URL/);
  });
});
