import 'jsdom-global/register';
import { afterEach } from 'mocha';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
});
