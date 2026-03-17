#include "thief.h"
#include "monster.h"
Thief::Thief(string nickname) : Player(nickname) {
    job_name = "도적";
    HP = 100; MP = 80; power = 15; defence = 8; accuracy = 20; speed = 20;
}
void Thief::attack() {
    cout << "* " << nickname << "이(가) 단검으로 빠르게 연속공격합니다!" << endl;
}
void Thief::attack(Monster* monster) {
    int damage = power - monster->getDefence();
    if (damage <= 0) damage = 1;
    int single = damage / 5;
    if (single <= 0) single = 1;
    for (int i = 0; i < 5; i++)
        cout << "* " << monster->getName() << "에게 단검으로 " << single << "의 피해를 입혔다!" << endl;
    monster->setHP(monster->getHP() - single * 5);
    if (monster->getHP() <= 0)
        cout << "* " << monster->getName() << "을(를) 물리쳤습니다! 승리!" << endl;
    else
        cout << monster->getName() << "의 남은 HP: " << monster->getHP() << endl;
}
