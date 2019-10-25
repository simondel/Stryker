import { StrykerOptions } from '@stryker-mutator/api/core';
import { Logger } from '@stryker-mutator/api/logging';
import { commonTokens, tokens } from '@stryker-mutator/api/plugin';
import { mutationTestReportSchema, Reporter } from '@stryker-mutator/api/report';
import { calculateMetrics } from 'mutation-testing-metrics';
import { CIProvider } from '../ci/Provider';
import DashboardReporterClient from './DashboardReporterClient';
import { dashboardReporterTokens } from './tokens';
import { Report } from './Report';

export default class DashboardReporter implements Reporter {
  public static readonly inject = tokens(
    commonTokens.logger,
    dashboardReporterTokens.dashboardReporterClient,
    commonTokens.options,
    dashboardReporterTokens.ciProvider
  );

  constructor(
    private readonly log: Logger,
    private readonly dashboardReporterClient: DashboardReporterClient,
    private readonly options: StrykerOptions,
    private readonly ciProvider: CIProvider | null
  ) {}

  public async onMutationTestReportReady(result: mutationTestReportSchema.MutationTestResult) {
    const { projectName, version, moduleName } = this.getContextFromEnvironment();
    if (projectName && version) {
      await this.update(this.toReport(result), projectName, version, moduleName);
    } else {
      this.log.info(
        'The report was not send to the dashboard. The dashboard.project and/or dashboard.version values were missing and not detected to be running on a build server.'
      );
    }
  }

  private toReport(result: mutationTestReportSchema.MutationTestResult): Report {
    if (this.options.dashboard.fullReport) {
      return {
        result
      };
    } else {
      return {
        mutationScore: calculateMetrics(result.files).metrics.mutationScore
      };
    }
  }

  private async update(report: Report, projectName: string, version: string, moduleName: string | undefined) {
    try {
      const href = await this.dashboardReporterClient.updateReport({
        report,
        moduleName,
        projectName,
        version: version
      });
      this.log.info('Report available at: %s', href);
    } catch (err) {
      this.log.error('Could not upload report.', err);
    }
  }

  private getContextFromEnvironment() {
    return {
      moduleName: this.options.dashboard.module,
      projectName: this.options.dashboard.project || (this.ciProvider && this.ciProvider.determineProject()),
      version: this.options.dashboard.version || (this.ciProvider && this.ciProvider.determineVersion())
    };
  }
}
