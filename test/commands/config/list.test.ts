import { expect, test } from '@oclif/test'

describe('config list', () => {
  test
    .stdout()
    .command(['config:list'])
    .it('runs list cmd', (ctx) => {
      expect(ctx.stdout).to.contain('=')
    })
})
