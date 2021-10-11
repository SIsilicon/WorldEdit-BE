import { Entity } from '../build/classes/entityBuilder.js';
import { Player } from '../build/classes/playerBuilder.js';
import { compressNumber, formatNumber } from '../utils/formatter.js';
/**
 * Display a leaderboard on floating text of the top players on scoreboard(s). For this leaderboard to display highest ranking players, the players must join the game while this function is running.
 * @param {number} x The x position of your floating text entity
 * @param {number} y The y position of your floating text entity
 * @param {number} z The z position of your floating text entity
 * @param {Array<string>} objective The scoreboard objective you want to display the players from. Supports multiple objectives. All the scores from the objectives will be added together!
 * @param {number} displayLength Amount of players you would display in the leaderboard
 * @param {string} [heading] Text you want to display on top of the leaderboard
 * @param {string} [layout] The way players ranking, gamertag, and score will be displayed. Example: "§e#$(RANK) §7$(GAMERTAG) §r- §e$(SCORE)". The $(RANK) part will display the users rank in the scoreboard. $(GAMERTAG) will display that users GamerTag. And last of all $(SCORE) will display that users score in that scoreboard. It would look like this while being displayed, example: §e#1 §7TestUser1234 §r- §e$6969696
 * @param {boolean} [compressScore] This will display in text in thousands, millions and etc... For ex: "1400 -> "1.4k", "1000000" -> "1M", etc...
 * @param {boolean} [formatScore] Will format your score. For ex: "1400" -> "1,400", "1000000" -> "1,000,000", etc...
 * @example writeLeaderboard([0, 6, 0], 'money', 10, { heading: 'Money Leaderboard\nTop players with the most Money\n§r\n', layout: '§e#$(RANK) §b$(GAMERTAG) §f- §a$§c$(SCORE)' }, { compressScore: true });
 */
export function writeLeaderboard([x, y, z], objective, displayLength, { heading, layout } = {}, { compressScore, formatScore } = {}) {
    heading ? null : heading = `${objective[0].toUpperCase()} LEADERBOARD`;
    layout ? null : layout = '§e#$(RANK) §7$(GAMERTAG) §r- §e$(SCORE)';
    const getEntity = Entity.getAtPos([x, y, z], { ignoreType: ['minecraft:player'] });
    if (getEntity.error)
        return;
    const entityName = getEntity.list[0].nameTag.replace(/\n|§/g, '');
    let dataGamertag = entityName.match(/(?<=\$\(objective{gamertag: ).+?(?=, score: .*?}\))/g);
    let dataScore = entityName.match(/(?<=\$\(objective{gamertag: \D.*, score: ).+?(?=}\))/g);
    let leaderboard = [];
    if (dataGamertag && getEntity.list[0].nameTag)
        dataGamertag.map((gamertag, index) => {
            leaderboard.push({ gamertag, score: parseInt(dataScore[index].replace(/\D/g, '0')) });
        });
    const onlinePlayers = Player.list();
    for (const player of onlinePlayers) {
        let score = 0;
        for (const dummy of objective) {
            const objScore = Entity.getScore(dummy, `[type=player,name="${player}"]`);
            if (!objScore)
                return;
            score += objScore;
        }
        ;
        const index = leaderboard.findIndex((obj => obj.gamertag === player));
        if (index !== -1)
            leaderboard[index].score = score;
        else
            leaderboard.push({ gamertag: player, score });
    }
    ;
    leaderboard = [...new Map(leaderboard.map(item => [item['gamertag'], item])).values()];
    leaderboard.sort((a, b) => b.score - a.score);
    let leaderboardString = `${heading}\n§r`, saveData = '';
    for (let i = 0; i < displayLength && i < leaderboard.length; i++) {
        saveData.replace(new RegExp(`\\$\\(objective{gamertag: ${leaderboard[i].gamertag}, score: ${leaderboard[i].score}}\\)`, 'g'), '');
        leaderboardString += `${layout.replace(/\$\(RANK\)/g, `${i + 1}`).replace(/\$\(GAMERTAG\)/g, leaderboard[i].gamertag).replace(/\$\(SCORE\)/g, `${compressScore ? compressNumber(leaderboard[i].score) : formatScore ? formatNumber(leaderboard[i].score) : leaderboard[i].score}`)}§r\n`;
        saveData += `$(objective{gamertag: ${leaderboard[i].gamertag}, score: ${leaderboard[i].score}}) `;
    }
    ;
    saveData = saveData ? `§${saveData.replace(/\s*$/, '').split('').join('§')}` : '';
    getEntity.list[0].nameTag = `${leaderboardString}${saveData}`;
}
;
