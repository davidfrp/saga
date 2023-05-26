import { expect, test } from '@oclif/test'
import { Config } from '@oclif/core'
import Get from '../../../src/commands/config/get'

describe('config get', () => {
  const config = new Config({ root: __dirname })
  const cmd = new Get([], config)

  test
    .stdout()
    .command(['config:get', 'email'])
    .it('runs get cmd', (ctx) => {
      const email = cmd.store.get('email')
      expect(ctx.stdout).to.be.equal(`${email}\n`)
    })

  test
    .stderr()
    .command(['config:get', 'somenonexistentkey'])
    .exit(1)
    .it('exits with code 1 if the key is not found')
})
