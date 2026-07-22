//https://school.programmers.co.kr/learn/courses/30/lessons/42578

#include <string>
#include <vector>
#include <unordered_map>

using namespace std;

int solution(vector<vector<string>> clothes) {
    unordered_map<string, int> cnt;                // 의상 종류 → 개수
    for (auto& c : clothes) cnt[c[1]]++;

    int answer = 1;
    for (auto& [kind, n] : cnt) answer *= n + 1;   // 종류마다 "안 입기" 포함 n+1가지
    return answer - 1;                             // 아무것도 안 입는 경우 1가지 제외
}
