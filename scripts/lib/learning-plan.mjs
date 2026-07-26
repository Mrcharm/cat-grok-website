const pad = value => String(value).padStart(2, '0');

const addDays = (iso, amount) => {
  const date = new Date(iso + 'T12:00:00');
  date.setDate(date.getDate() + amount);
  return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate());
};

const phaseAssets = {
  foundation: 'foundation',
  product: 'product',
  delivery: 'delivery',
  influence: 'influence'
};

export function expandLearningPlan(plan) {
  let index = 0;
  const tasks = [];

  for (const phase of plan.phases) {
    for (const week of phase.weeks) {
      for (const session of week.sessions) {
        const date = addDays(plan.startDate, index);
        const resources = session.resources.map(key => {
          const resource = plan.resources[key];
          if (!resource) throw new Error('unknown learning resource: ' + key);
          return resource;
        });
        tasks.push({
          id: 'ai' + String(index + 1).padStart(3, '0'),
          date,
          dayNumber: index + 1,
          asset: phaseAssets[phase.id] || phase.id,
          phaseId: phase.id,
          phaseTitle: phase.title,
          phaseGoal: phase.goal,
          weekTitle: week.title,
          title: session.title,
          why: session.question,
          deliverable: session.output,
          method: plan.method,
          steps: [
            '前 8 分钟只读参考资料中与今日问题直接相关的一节，记下 3 个关键点。',
            '用 15 分钟套入你的银行数据研发场景完成：' + session.practice,
            '最后 7 分钟回答核心问题，写一个反例或失效边界，并保存结果证据。'
          ],
          resources,
          completion: session.completion,
          isWeeklyReportDay: new Date(date + 'T12:00:00').getDay() === 5
        });
        index += 1;
      }
    }
  }

  return tasks;
}
