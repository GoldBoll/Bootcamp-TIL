//https://school.programmers.co.kr/learn/courses/30/lessons/118666

#include <string>
#include <vector>

using namespace std;

string solution(vector<string> survey, vector<int> choices) {
    string answer = "";

    string lo = "RCJA";             // 각 지표의 사전순 앞 유형
    string hi = "TFMN";             // 각 지표의 사전순 뒤 유형
    int score[4] = {0, 0, 0, 0};    // 양수면 lo, 음수면 hi 우세 (0이면 사전순 lo)

    for (int i = 0; i < (int)survey.size(); i++) {
        int c = choices[i];
        char gain;                  // 점수를 얻는 유형
        int p;                      // 얻는 점수
        if (c < 4)      { gain = survey[i][0]; p = 4 - c; }  // 비동의 쪽
        else if (c > 4) { gain = survey[i][1]; p = c - 4; }  // 동의 쪽
        else            { continue; }                        // 모르겠음

        for (int k = 0; k < 4; k++) {
            if (gain == lo[k]) { score[k] += p; break; }
            if (gain == hi[k]) { score[k] -= p; break; }
        }
    }

    for (int k = 0; k < 4; k++)
        answer += (score[k] >= 0) ? lo[k] : hi[k];

    return answer;
}
