use strict;
use warnings;
use v5.30;

use File::Slurp;
use JSON;

# NOTE: run from tmp/ directory

open my $out, '>', '../data/case_notes.csv';
say $out join( ", ", map { qq{"$_"} } qw( case_id visit_id visit_date note note_type genai_summary version ) );

foreach my $filename ( <../data/*.json> ) {
    my $file_contents = read_file( $filename ) =~ s/\x{ef}\x{bb}\x{bf}//r;
    my $data = from_json( $file_contents ) or die "$!\n";

    foreach my $rec ( $data->@* ) {
        my @row = map { qq{"$rec->{$_}"} } ( "Case ID", "Visit ID", "Visit Date", "Case Note" );
        push @row, '"note"';
        push @row, 'null';
        push @row, 1;
        say $out join( ",", @row );
    }
}

close $out;