#include "magician.h"
#include "monster.h"
Magician::Magician(string nickname) : Player(nickname) {
    job_name = "마법사";
    HP = 80; MP = 150; power = 25; defence = 5; accuracy = 15; speed = 8;
}
void Magician::attack() {
    cout << "* " << nickname << "이(가) 마법 화살을 쏩니다!" << endl;
}
void Magician::attack(Monster* monster) {
    int damage = power - monster->getDefence();
    if (damage <= 0) damage = 1;
    cout << "* " << monster->getName() << "에게 마법으로 " << damage << "의 피해를 입혔다!" << endl;
    monster->setHP(monster->getHP() - damage);
    if (monster->getHP() <= 0)
        cout << "* " << monster->getName() << "을(를) 물리쳤습니다! 승리!" << endl;
    else
        cout << monster->getName() << "의 남은 HP: " << monster->getHP() << endl;
}
