import { Hook } from "@oclif/core";
import updateNotifier from "update-notifier";

const hook: Hook<"init"> = async function ({ config }) {
  updateNotifier({ pkg: config.pjson, updateCheckInterval: 0 }).notify();
};

export default hook;
