// Skills page - download handlers
document.querySelectorAll('.dl-btn:not(.zip)').forEach(btn => {
  btn.addEventListener('click', () => {
    const skill = btn.dataset.skill;
    // Show info alert for now (will be wired to actual skill file download)
    alert('下载 ' + skill + ' 的 SKILL.md（变量已脱敏）\n\n功能即将上线，当前为预览版本。');
  });
});

document.querySelectorAll('.dl-btn.zip').forEach(btn => {
  btn.addEventListener('click', () => {
    const skill = btn.dataset.zip;
    alert('打包下载 ' + skill + ' 整个目录（含 references/specs/evals）\n\n功能即将上线，当前为预览版本。');
  });
});
