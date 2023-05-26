export type GetProjectsResponse = {
  id: string
  key: string
  name: string
}

export type Project = {
  id: string
  key: string
  name: string
}

export type GetUserResponse = {
  accountId: string
  emailAddress: string
  displayName: string
}

export type User = {
  id: string
  email: string
  displayName: string
}

export enum StatusCategory {
  Undefined = 'undefined',
  ToDo = 'new',
  InProgress = 'indeterminate',
  Completed = 'done',
}

export type SearchIssueResponse = {
  id: string
  key: string
  fields: {
    summary: string
    assignee?: GetUserResponse
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

export type SearchIssuesResponse = {
  issues: SearchIssueResponse[]
}

export type Issue = {
  key: string
  summary: string
  url: string
  assignee?: User
  type: {
    name: string
  }
  status: {
    name: string
    category: StatusCategory
  }
}

export type GetIssueTransitionsResponse = {
  transitions: {
    id: string
    name: string
    to: {
      description: string
      statusCategory: {
        name: string
        key: StatusCategory
      }
    }
  }[]
}

export type IssueTransition = {
  id: string
  name: string
  description: string
  status: {
    name: string
    category: StatusCategory
  }
}
