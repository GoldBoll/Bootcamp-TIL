// 프로그래머스 92334 - 신고 결과 받기 (Lv.1, 2022 KAKAO BLIND RECRUITMENT)
// https://school.programmers.co.kr/learn/courses/30/lessons/92334

// 문제 설명
// 각 유저는 다른 유저를 신고할 수 있다. report 원소는 "신고자 피신고자" 형식.
// 한 유저가 같은 유저를 여러 번 신고해도 1회로만 친다(중복 제거).
// k번 이상 신고당한 유저는 정지되고, 그 유저를 신고한 사람들에게 처리 결과 메일이 간다.
// id_list 순서대로 각 유저가 받은 메일 수를 반환하라.

// 제약 조건
// 2 <= id_list 길이 <= 1000, 1 <= report 길이 <= 200,000, 1 <= k <= 200

// 예제
// id_list=["muzi","frodo","apeach","neo"]
// report=["muzi frodo","apeach frodo","frodo neo","muzi neo","apeach muzi"], k=2
// 결과: [2,1,1,0]

// 접근 — 해시맵 카운팅 O(report)
// 1) report를 set으로 중복 제거 ("신고자 피신고자" 문자열 통째로)
// 2) 피신고자별 신고당한 횟수 reportedCnt, 피신고자별 신고자 목록 reporters 수집
// 3) reportedCnt >= k 인 유저(정지 대상)를 신고한 사람마다 answer[+1]
// 핵심 함정: "한 사람이 같은 사람을 여러 번 신고 → 1회"라서 중복 제거를 먼저 해야
//            신고 횟수와 메일 수가 둘 다 어긋나지 않는다.

#include <string>
#include <vector>
#include <unordered_map>
#include <unordered_set>
#include <sstream>
using namespace std;

vector<int> solution(vector<string> id_list, vector<string> report, int k)
{
    unordered_map<string, int> idx;                  // 유저 → id_list 인덱스
    for (int i = 0; i < (int)id_list.size(); i++)
        idx[id_list[i]] = i;

    unordered_set<string> seen;                      // 중복 신고 제거 ("신고자 피신고자")
    unordered_map<string, vector<string>> reporters; // 피신고자 → 신고한 사람들
    unordered_map<string, int> reportedCnt;          // 피신고자 → 신고당한 횟수

    for (const string& r : report)
    {
        if (!seen.insert(r).second) continue;        // 이미 본 신고면 건너뜀
        stringstream ss(r);
        string from, to;
        ss >> from >> to;
        reporters[to].push_back(from);
        reportedCnt[to]++;
    }

    vector<int> answer(id_list.size(), 0);
    for (const auto& p : reportedCnt)
    {
        if (p.second >= k)                           // 정지 대상
            for (const string& from : reporters[p.first])
                answer[idx[from]]++;
    }
    return answer;
}

// 예제 1 추적: frodo는 muzi·apeach 2명에게 신고당함(>=2 정지),
//   neo는 frodo·muzi 2명에게 신고당함(>=2 정지). muzi는 apeach 1명(미정지).
//   정지된 frodo의 신고자 muzi·apeach +1, neo의 신고자 frodo·muzi +1
//   → muzi=2, frodo=1, apeach=1, neo=0 → [2,1,1,0] ✅
// 예제 2 추적: report 4개가 모두 "ryan con" → 중복 제거로 1개,
//   con은 1회 신고당함, k=3 미만이라 정지 없음 → [0,0] ✅
