export type Project = {
  id: string
  key: string
  name: string
}

export type User = {
  accountId: string
  emailAddress: string
  displayName: string
}

export enum StatusCategory {
  Undefined = "undefined",
  ToDo = "new",
  InProgress = "indeterminate",
  Completed = "done",
}

export type Issue = {
  id: string
  key: string
  fields: {
    summary: string
    assignee?: User
    issuetype: {
      name: string
      iconUrl: string
    }
    status: {
      name: string
      statusCategory: {
        key: StatusCategory
      }
    }
  }
}

export type Transition = {
  id: string
  name: string
  to: {
    description: string
    statusCategory: {
      name: string
      key: StatusCategory
    }
  }
}
