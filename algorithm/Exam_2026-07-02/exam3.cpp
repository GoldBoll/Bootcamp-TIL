// 백준 2852 - NBA 농구
// https://www.acmicpc.net/problem/2852

// 문제 설명
// 48분 경기의 득점 기록(팀 번호, MM:SS)이 시간순으로 주어질 때
// 각 팀이 이기고 있던 총 시간을 MM:SS로 출력.

// 제약 조건
// 1 <= N <= 100, 분 0~47, 초 0~59, 득점 시간 중복 없음

// 예제
// 입력                출력
// 3                   20:00
// 1 01:10             16:30
// 2 21:10
// 2 31:30

// 접근
// 초로 통일한 이벤트 시뮬레이션
// 골마다 [직전 골, 지금] 구간을 이기던 팀에 적립(적립 먼저, 스코어 갱신 나중)
// 마지막 골 이후 48:00까지 잔여 구간 정산

#include <iostream>
#include <string>
#include <map>
#include <vector>
#include <queue>
#include <deque>
#include <cstring>
#include <algorithm>
using namespace std;
#define endl '\n'

int n, s1, s2, t1, t2, pt;

int toSec(string s)
{
    return ((s[0] - '0') * 10 + s[1] - '0') * 60 + (s[3] - '0') * 10 + s[4] - '0';
}

void print(int t)
{
    cout << t / 60 / 10 << t / 60 % 10 << ':' << t % 60 / 10 << t % 60 % 10 << endl;
}

int main()
{
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);
    cout.tie(NULL);

    cin >> n;
    while (n--) {
        int a;
        string s;
        cin >> a >> s;
        int t = toSec(s);
        if (s1 > s2) t1 += t - pt;
        if (s2 > s1) t2 += t - pt;
        if (a == 1) s1++;
        else s2++;
        pt = t;
    }
    if (s1 > s2) t1 += 48 * 60 - pt;
    if (s2 > s1) t2 += 48 * 60 - pt;
    print(t1);
    print(t2);

    return 0;
}
