// 프로그래머스 92341 - 주차 요금 계산 (Lv.5)
// https://school.programmers.co.kr/learn/courses/30/lessons/92341

// 문제 설명
// 요금표 fees = [기본시간(분), 기본요금(원), 단위시간(분), 단위요금(원)] 과
// "HH:MM 차량번호 IN/OUT" 형식의 입출차 기록 records가 주어진다.
// 차량별 누적 주차 시간으로 요금을 계산해 차량번호 오름차순으로 반환하라.
// 출차 기록이 없는 차량은 23:59에 출차한 것으로 본다.

// 제약 조건
// fees 길이 4, 1 <= 기본시간/단위시간 <= 1439, 0 <= 기본요금 <= 100,000, 1 <= 단위요금 <= 10,000
// 1 <= records 길이 <= 1,000, 차량번호는 4자리 숫자, 잘못된 입력은 주어지지 않는다
// 누적 시간 <= 기본시간 이면 기본요금
// 초과하면 기본요금 + ceil((누적 - 기본시간) / 단위시간) * 단위요금

// Example
// Input : fees = [180,5000,10,600],
//         records = ["05:34 5961 IN","06:00 0000 IN","06:34 0000 OUT","07:59 5961 OUT",
//                    "07:59 0148 IN","18:59 0000 IN","19:09 0148 OUT","22:59 5961 IN","23:00 5961 OUT"]
// Output: [14600, 34400, 5000]   (0000=334분, 0148=670분, 5961=146분)
//
// Input : fees = [120,0,60,591], records = ["16:00 3961 IN","16:00 0202 IN",
//                 "18:00 3961 OUT","18:00 0202 OUT","23:58 3961 IN"]
// Output: [0, 591]               (0202=120분 → 기본요금 0, 3961=120+1=121분 → 1단위 초과)
//
// Input : fees = [1,461,1,10], records = ["00:00 1234 IN"]
// Output: [14841]                (미출차 → 23:59, 1439분)

// 접근 — 시각을 분으로 정규화한 시뮬레이션 + map 자동 정렬
// 1) "HH:MM"을 분 단위 int로 바꿔 시/분 경계 계산을 없앤다.
// 2) inTime: 아직 안 나간 차량의 입차 시각. OUT을 만나면 차이를 total에 더하고 지운다.
// 3) 기록을 다 읽고 inTime에 남은 차량은 23:59(1439분)까지 주차한 것으로 정산.
// 4) map<string,int>는 키 순으로 순회한다. 차량번호가 4자리 0채움 문자열이라
//    사전순 == 번호 오름차순이므로 별도 정렬이 필요 없다.
// 5) 초과분 올림은 실수 ceil 대신 (a + b - 1) / b 정수 연산으로 처리.
// 시간 O(m log m) (m = records 길이), 공간 O(차량 수)

#include <string>
#include <vector>
#include <map>

using namespace std;

// "HH:MM" → 자정부터 지난 분
int toMin(const string& t) {
    return (t[0] - '0') * 600 + (t[1] - '0') * 60 + (t[3] - '0') * 10 + (t[4] - '0');
}

vector<int> solution(vector<int> fees, vector<string> records) {
    map<string, int> inTime;                       // 차량번호 → 입차 시각(미출차 상태)
    map<string, int> total;                        // 차량번호 → 누적 주차 시간(분)

    for (auto& r : records) {
        string car = r.substr(6, 4), act = r.substr(11);
        int t = toMin(r.substr(0, 5));
        if (act == "IN") inTime[car] = t;
        else {
            total[car] += t - inTime[car];
            inTime.erase(car);                     // 출차 처리 완료 — 미출차 목록에서 제거
        }
    }
    for (auto& [car, t] : inTime) total[car] += 1439 - t;   // 남은 차량은 23:59 출차

    vector<int> answer;
    for (auto& [car, t] : total) {                 // map이라 차량번호 오름차순으로 순회
        int fee = fees[1];
        if (t > fees[0])
            fee += ((t - fees[0]) + fees[2] - 1) / fees[2] * fees[3];   // 정수 올림
        answer.push_back(fee);
    }
    return answer;
}
