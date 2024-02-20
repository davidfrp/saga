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
  url: string // custom field
  fields: {
    summary: string
    assignee?: User
    lastViewed?: Date
    parent?: Issue
    issuetype: {
      name: string
      iconUrl: string
      color?: string // custom field
    }
    status: {
      name: string
      statusCategory: {
        key: StatusCategory
      }
    }
    priority: {
      name: string
      iconUrl: string
      color?: string // custom field
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
