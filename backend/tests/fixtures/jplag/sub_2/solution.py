def count_primes(bound):
    total = 0
    for candidate in range(2, bound + 1):
        is_prime = True
        for factor in range(2, candidate):
            if candidate % factor == 0:
                is_prime = False
                break
        if is_prime:
            total += 1
    return total


def summarize(numbers):
    output = []
    for number in numbers:
        if number % 2 == 0:
            output.append(number * 2)
        else:
            output.append(number + 1)
    return output
