const { exec } = require('child_process');

const VOLS = ['/vol1', '/vol3'];
const INTERVAL = 30 * 60 * 1000; // 30分钟

function getVolUsage() {
    return new Promise((resolve, reject) => {
        exec(`df -P ${VOLS.join(' ')}`, (err, stdout) => {
            if (err) return reject(err);

            const lines = stdout.trim().split('\n');
            const result = [];

            for (let i = 1; i < lines.length; i++) {
                const cols = lines[i].split(/\s+/);

                result.push({
                    mount: cols[5],
                    usage: cols[4],
                    size: cols[1],
                    used: cols[2],
                    available: cols[3],
                });
            }

            resolve(result);
        });
    });
}

async function checkDisk() {
    try {
        const data = await getVolUsage();

        console.log(`\n📊 [${new Date().toLocaleString()}] 磁盘状态：`);

        data.forEach(v => {
            const percent = parseInt(v.usage);

            console.log(`${v.mount} -> ${v.usage} (used: ${v.used} / total: ${v.size})`);

            if (percent >= 80) {
                console.log(`🚨 WARNING: ${v.mount} 使用率过高！`);
            }
        });

    } catch (err) {
        console.error('❌ 获取磁盘信息失败:', err.message);
    }
}

// 立即执行一次
checkDisk();

// 每30分钟执行一次
setInterval(checkDisk, INTERVAL);