const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.static(__dirname));

const jobData = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'data', 'future_job_3960.json'), 'utf8')
);

const riasecKeywords = {
  R: ['설계', '하드웨어', '인프라', '로봇', '센서', '제어', '회로', '엔지니어링', '제조', '자동화'],
  I: ['양자', '알고리즘', '연구', '탐구', '시뮬레이션', '모델링', '실험', '데이터 과학', '최적화', '분석'],
  A: ['창의', '콘텐츠', '디자인', '기획', '스토리', '인터페이스', '명령어', '프롬프트', '메타버스', '가상현실'],
  S: ['의료', '복지', '보건', '상담', '교육', '돌봄', '치료', '공감', '커뮤니티', '사회적'],
  E: ['비즈니스', '전략', '경영', '리더', '정책', '스타트업', '투자', '협상', '민간', '혁신 경영'],
  C: ['품질 관리', '프로세스', '규정', '감사', '체계', '수립', '운영 효율', '표준화', '인증', '컴플라이언스']
};

const big5Keywords = {
  O: ['혁신', '차세대', '새로운', '창의', '미래', '융합', '도전', '선도', '개척', '트렌드'],
  C: ['기준', '효율', '목표', '정밀', '계획', '품질', '일정', '마감', '책임', '완수'],
  E: ['소통', '협업', '커뮤니티', '서비스', '교육', '네트워크', '글로벌', '팀', '발표', '강연'],
  A: ['의료', '복지', '보건', '공감', '신뢰', '지원', '돌봄', '사회적', '배려', '봉사'],
  N: ['안전', '보호', '리스크', '감시', '모니터링', '예방', '보안', '안정화', '위기', '대응']
};

function calcScore(desc, keywords) {
  if (!keywords || keywords.length === 0) return 0;

  const maxPerKeyword = 3;

  const rawScore = keywords.reduce((sum, kw) => {
    const count = desc.split(kw).length - 1;
    return sum + Math.min(count, maxPerKeyword);
  }, 0);

  const maxPossible = keywords.length * maxPerKeyword;
  return (rawScore / maxPossible) * 100;
}

app.post('/recommend', (req, res) => {
  const { name, dob, country, ability, riasec, big5 } = req.body;

  const birthYear = parseInt(dob, 10);

  if (Number.isNaN(birthYear) || birthYear < 1900 || birthYear > 2100) {
    return res.status(400).json({
      error: '출생연도 형식이 올바르지 않습니다. 예) 2010 형식으로 입력해 주세요.'
    });
  }

  let addYear;

  if (ability === '상') {
    addYear = 30;
  } else if (ability === '중') {
    addYear = 26;
  } else {
    addYear = 22;
  }

  const year = birthYear + addYear;
  const period = `${Math.floor(year / 10) * 10}년대`;

  const candidates = jobData.filter(
    row => row['국가'] === country &&
           row['시기'] === period &&
           row['직업등급'] === ability
  );

  const candidateCount = candidates.length;

  if (candidateCount === 0) {
    return res.status(404).json({
      error: ` '${period}' 취업시기의 데이터는 없습니다. [생년월일]을 2000년~2029년 범위내로 (취업시기 2030~2050년대) 수정 입력하세요. `
    });
  }

  const rkws = riasecKeywords[riasec] || [];
  const bkws = big5Keywords[big5] || [];

  candidates.forEach(row => {
    const desc = row['직업해설'] || '';
    row.riasec_raw = calcScore(desc, rkws);
    row.big5_raw = calcScore(desc, bkws);
  });

  const maxR = Math.max(...candidates.map(r => r.riasec_raw), 1);
  const maxB = Math.max(...candidates.map(r => r.big5_raw), 1);

  candidates.forEach(row => {
    row.riasec_score = Math.round((row.riasec_raw / maxR) * 100 * 100) / 100;
    row.big5_score = Math.round((row.big5_raw / maxB) * 100 * 100) / 100;
    row.final_score = Math.round((row.riasec_score * 0.6 + row.big5_score * 0.4) * 100) / 100;
  });

  const allZero = candidates.every(row => row.riasec_raw === 0 && row.big5_raw === 0);

  candidates.sort(
    (a, b) => b.final_score - a.final_score ||
      parseInt(a['연봉순위'], 10) - parseInt(b['연봉순위'], 10)
  );

  const best = candidates[0];

  const zeroScoreNote = allZero
    ? '성향 키워드 매칭 결과가 없어 연봉순위 기준으로 최상위 직업을 추천하였습니다.'
    : '';

  res.json({
    name,
    country,
    period,
    job: best['추천직업'] || '',
    salaryRank: best['연봉순위'] || '',
    description: best['직업해설'] || '',
    knowledge: best['핵심 전문 지식'] || '',
    major: best['추천 학과/전공'] || '',
    prepPeriod: best['준비 기간'] || '',
    candidateCount,
    riasecScore: best.riasec_score != null ? best.riasec_score.toFixed(1) : '0.0',
    big5Score: best.big5_score != null ? best.big5_score.toFixed(1) : '0.0',
    finalScore: best.final_score != null ? best.final_score.toFixed(1) : '0.0',
    zeroScoreNote
  });
});

// ✅ 로컬: 기본 3003 유지
// ✅ Render/Web: process.env.PORT가 주입되므로 자동으로 그 포트 사용
const PORT = Number(process.env.PORT) || 3003;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));