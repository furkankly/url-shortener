import { join } from "path";
import * as childProcess from "child_process";

function buildSPA(bucketName: string, endpoint: string) {
  const spaProjectDir = join(__dirname, "../client");

  childProcess.execSync(`bun install`, {
    stdio: "inherit",
    cwd: spaProjectDir,
  });
  childProcess.execSync(
    `VITE_REMIX_APP_API=${endpoint}/api bun run remix vite:build`,
    {
      stdio: "inherit",
      cwd: spaProjectDir,
    },
  );
  childProcess.execSync(
    `aws s3 sync ${spaProjectDir}/build/client s3://${bucketName}`,
    {
      stdio: "inherit",
    },
  );
}

const args = process.argv.slice(2);
const bucketName = args[0];
const endpoint = args[1];

buildSPA(bucketName, endpoint);
