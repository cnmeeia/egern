const { exec } = require('child_process');

/**
 * 获取指定挂载点的磁盘使用率
 * @param {string} path - 挂载路径，默认为根目录 '/'
 * @returns {Promise<string>} - 返回百分比字符串，例如 '45%'
 */
function getDiskUsage(path = '/') {
    return new Promise((resolve, reject) => {
        // 使用 df -h 命令查看磁盘空间
        // grep 过滤出对应路径的行
        // awk '{print $5}' 提取第5列（即 Use%）
        const command = `df -h "${path}" | tail -1 | awk '{print $5}'`;

        exec(command, (error, stdout, stderr) => {
            if (error) {
                console.error(`执行出错: ${error.message}`);
                return reject(error);
            }
            if (stderr) {
                console.error(`命令错误: ${stderr}`);
                return reject(stderr);
            }
            // 去除换行符并返回
            resolve(stdout.trim());
        });
    });
}

// 使用示例
(async () => {
    try {
        const usage = await getDiskUsage('/');
        console.log(`当前磁盘使用率: ${usage}`);
    } catch (err) {
        console.error('获取磁盘信息失败');
    }
})();

module.exports = getDiskUsage;
