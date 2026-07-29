//https://school.programmers.co.kr/learn/courses/30/lessons/132265

#include <vector>

using namespace std;

int rightKinds[1000000];    // rightKinds[i] = i번째부터 끝까지의 토핑 종류 수
int cntR[10001];            // 오른쪽 조각의 토핑별 개수
int cntL[10001];            // 왼쪽 조각의 토핑별 개수

int solution(vector<int> topping) {
    int n = topping.size();

    int kinds = 0;
    for (int i = n - 1; i >= 0; i--) {
        if (cntR[topping[i]]++ == 0) kinds++;       // 처음 등장한 토핑일 때만 종류 +1
        rightKinds[i] = kinds;
    }

    int answer = 0;
    kinds = 0;
    for (int i = 0; i < n - 1; i++) {               // 마지막 원소 뒤는 자를 수 없다
        if (cntL[topping[i]]++ == 0) kinds++;
        if (kinds == rightKinds[i + 1]) answer++;   // i까지 / i+1부터로 갈랐을 때 종류 수 일치
    }
    return answer;
}
