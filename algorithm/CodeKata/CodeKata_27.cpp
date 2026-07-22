//https://school.programmers.co.kr/learn/courses/30/lessons/131701

#include <vector>
#include <set>

using namespace std;

int solution(vector<int> elements) {
    int n = elements.size();
    set<int> sums;                            // 합의 "종류"만 세면 되므로 set으로 중복 제거

    for (int i = 0; i < n; i++) {             // 시작 인덱스
        int sum = 0;
        for (int len = 0; len < n; len++) {   // 길이 1..n
            sum += elements[(i + len) % n];   // 원형: 끝을 넘으면 앞으로 감아서 이어붙임
            sums.insert(sum);
        }
    }
    return sums.size();
}
