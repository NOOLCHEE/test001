// [싱크 매칭 타이밍 전면 개편]
// 모든 빵의 판정 기준을 good1: 1.5초(1500ms), smurfy: 2.0초(2000ms), burnt: 3.0초(3000ms)로 대통합
window.TIME_PENALTY_BURNT = 4.0; 
window.TIME_PENALTY_RAW = 0.0;   

window.BREAD_CONFIG = [
    { name: "크로와상", readyEmoji: "🥐", bakeTime: 3000, score: 30, good1: 1500, smurfy: 2000, burnt: 3000, penaltyBurnt: 20, penaltyRaw: 10 },
    { name: "프레첼", readyEmoji: "🥨", bakeTime: 4000, score: 40, good1: 1500, smurfy: 2000, burnt: 3000, penaltyBurnt: 20, penaltyRaw: 10 },
    { name: "식빵", readyEmoji: "🍞", bakeTime: 5000, score: 50, good1: 1500, smurfy: 2000, burnt: 3000, penaltyBurnt: 20, penaltyRaw: 10 },
    { name: "도넛", readyEmoji: "🥯", bakeTime: 6000, score: 30, good1: 1500, smurfy: 2000, burnt: 3000, penaltyBurnt: 20, penaltyRaw: 10 },
    { name: "바게트", readyEmoji: "🥖", bakeTime: 7000, score: 70, good1: 1500, smurfy: 2000, burnt: 3000, penaltyBurnt: 20, penaltyRaw: 10 }
];
