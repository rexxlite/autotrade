import cron from "node-cron";

export class BotScheduler {
  constructor({ config, screeningCycle, managementCycle, logger }) {
    this.config = config;
    this.screeningCycle = screeningCycle;
    this.managementCycle = managementCycle;
    this.logger = logger;
    this.jobs = [];
  }

  start() {
    this.jobs.push(
      cron.schedule(this.config.scheduler.screenCron, async () => {
        try {
          await this.screeningCycle.run();
        } catch (error) {
          this.logger.error("Screening job failed", { message: error.message });
        }
      })
    );

    this.jobs.push(
      cron.schedule(this.config.scheduler.manageCron, async () => {
        try {
          await this.managementCycle.run();
        } catch (error) {
          this.logger.error("Management job failed", { message: error.message });
        }
      })
    );

    this.logger.info("Scheduler started", {
      screenCron: this.config.scheduler.screenCron,
      manageCron: this.config.scheduler.manageCron
    });
  }

  stop() {
    for (const job of this.jobs) {
      job.stop();
      job.destroy();
    }
    this.jobs = [];
  }
}
