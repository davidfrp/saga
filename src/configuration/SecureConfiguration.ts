import keytar from "keytar"

export class SecureConfiguration<TSecureConfigurationEntries extends string> {
  readonly #service = "saga"

  public async getSecret(key: TSecureConfigurationEntries) {
    const secret = await keytar.getPassword(this.#service, key)
    return secret ?? undefined
  }

  public setSecret(key: TSecureConfigurationEntries, value: string) {
    return keytar.setPassword(this.#service, key, value)
  }

  public removeSecret(key: TSecureConfigurationEntries) {
    return keytar.deletePassword(this.#service, key)
  }
}
